use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

use reqwest::dns::{Addrs, Name, Resolve, Resolving};

/// Le plugin updater installe lui-même son fournisseur TLS, mais seulement au moment de
/// vérifier une mise à jour : les requêtes de l'app en ont besoin dès le démarrage.
pub fn install_tls_provider() {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
}

/// Adresse joignable depuis Internet : ni bouclage, ni réseau privé, ni lien local.
pub fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let o = v4.octets();
            !(v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
                || v4.is_multicast()
                || v4.is_documentation()
                // 100.64.0.0/10 (CGNAT) et 0.0.0.0/8
                || (o[0] == 100 && (64..128).contains(&o[1]))
                || o[0] == 0)
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(v4));
            }
            let seg = v6.segments();
            !(v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                // fc00::/7 (adresses locales uniques) et fe80::/10 (liens locaux)
                || (seg[0] & 0xfe00) == 0xfc00
                || (seg[0] & 0xffc0) == 0xfe80)
        }
    }
}

/// Résolveur DNS qui écarte les adresses non publiques : un nom qui pointe vers le réseau
/// local (ou qui y est redirigé après coup) ne peut pas être joint.
struct PublicOnlyResolver;

impl Resolve for PublicOnlyResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_string();
        Box::pin(async move {
            let found = tokio::net::lookup_host((host.as_str(), 0)).await?;
            let public: Vec<SocketAddr> = found.filter(|a| is_public_ip(a.ip())).collect();
            if public.is_empty() {
                return Err(format!("{host} does not resolve to a public address").into());
            }
            Ok(Box::new(public.into_iter()) as Addrs)
        })
    }
}

/// Une URL de redirection est suivie seulement en https et vers un hôte qui n'est pas une
/// adresse privée écrite en clair (les noms sont filtrés par le résolveur).
fn redirect_allowed(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && match url.host() {
            Some(url::Host::Ipv4(ip)) => is_public_ip(IpAddr::V4(ip)),
            Some(url::Host::Ipv6(ip)) => is_public_ip(IpAddr::V6(ip)),
            Some(url::Host::Domain(_)) => true,
            None => false,
        }
}

/// Valide une URL fournie par un site distant avant de la récupérer.
pub fn check_remote_url(raw: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(raw).map_err(|_| "Unsupported thumbnail URL".to_string())?;
    if redirect_allowed(&url) {
        Ok(url)
    } else {
        Err("Unsupported thumbnail URL".to_string())
    }
}

/// Client pour les ressources désignées par des sites tiers (vignettes) : https
/// uniquement, hôtes publics uniquement, redirections bornées et revérifiées.
pub fn remote_client() -> Result<reqwest::Client, String> {
    install_tls_provider();
    reqwest::Client::builder()
        .dns_resolver(PublicOnlyResolver)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 || !redirect_allowed(attempt.url()) {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Cannot build HTTP client: {e}"))
}

/// Client pour les téléchargements de l'app elle-même (GitHub) : pas de délai global,
/// l'inactivité est surveillée à la lecture.
pub fn download_client() -> Result<reqwest::Client, String> {
    install_tls_provider();
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Cannot build HTTP client: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn public_addresses_are_accepted() {
        for a in ["8.8.8.8", "1.1.1.1", "151.101.1.69", "2606:4700:4700::1111"] {
            assert!(is_public_ip(ip(a)), "{a}");
        }
    }

    #[test]
    fn private_and_local_addresses_are_refused() {
        for a in [
            "127.0.0.1",
            "10.0.0.5",
            "172.16.3.4",
            "192.168.1.10",
            "169.254.169.254",
            "0.0.0.0",
            "100.64.0.1",
            "224.0.0.1",
            "::1",
            "::",
            "fc00::1",
            "fd12:3456::1",
            "fe80::1",
            "::ffff:127.0.0.1",
            "::ffff:10.1.2.3",
        ] {
            assert!(!is_public_ip(ip(a)), "{a}");
        }
    }

    #[test]
    fn only_public_https_urls_pass_the_check() {
        assert!(check_remote_url("https://cdn.example/a.jpg").is_ok());
        assert!(check_remote_url("https://8.8.8.8/a.jpg").is_ok());
        for bad in [
            "http://cdn.example/a.jpg",
            "ftp://cdn.example/a.jpg",
            "file:///etc/passwd",
            "https://127.0.0.1/a.jpg",
            "https://[::1]/a.jpg",
            "https://192.168.0.1/a.jpg",
            "not a url",
            "",
        ] {
            assert!(check_remote_url(bad).is_err(), "{bad}");
        }
    }

    #[tokio::test]
    async fn localhost_does_not_resolve_through_the_public_resolver() {
        let name: Name = "localhost".parse().unwrap();

        assert!(PublicOnlyResolver.resolve(name).await.is_err());
    }
}
