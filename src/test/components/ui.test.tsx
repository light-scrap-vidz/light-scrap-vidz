import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

describe('Badge', () => {
  it('renders its children inside a span', () => {
    render(<Badge>New</Badge>);
    const badge = screen.getByText('New');
    expect(badge.tagName).toBe('SPAN');
  });

  it('keeps the base classes and appends the caller ones', () => {
    render(<Badge className="custom-class">New</Badge>);
    const badge = screen.getByText('New');
    expect(badge).toHaveClass('inline-flex', 'rounded-full', 'custom-class');
  });

  it('applies inline styles and forwards extra props', () => {
    render(
      <Badge style={{ color: 'rgb(255, 0, 0)' }} title="a badge">
        New
      </Badge>,
    );
    const badge = screen.getByTitle('a badge');
    expect(badge).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>New</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});

describe('Button', () => {
  it('renders a button that reacts to clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks while disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses the default variant and size when none is given', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-violet-500', 'h-10');
  });

  it.each([
    ['outline', 'border'],
    ['ghost', 'text-slate-400'],
    ['destructive', 'bg-red-500/20'],
  ] as const)('applies the %s variant', (variant, expected) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass(expected);
  });

  it.each([
    ['sm', 'h-8'],
    ['lg', 'h-12'],
    ['icon', 'h-9'],
  ] as const)('applies the %s size', (size, expected) => {
    render(<Button size={size}>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass(expected);
  });

  it('exposes the variant builder for reuse', () => {
    expect(buttonVariants({ variant: 'ghost', size: 'sm' })).toContain('h-8');
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('Input', () => {
  it('reports what the user types', () => {
    const onChange = vi.fn();
    render(<Input placeholder="url" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('url'), { target: { value: 'hello' } });

    expect(onChange).toHaveBeenCalled();
  });

  it('merges the caller className with the base styles', () => {
    render(<Input placeholder="url" className="w-1/2" />);
    expect(screen.getByPlaceholderText('url')).toHaveClass('rounded-xl', 'w-1/2');
  });

  it('can be disabled', () => {
    render(<Input placeholder="url" disabled />);
    expect(screen.getByPlaceholderText('url')).toBeDisabled();
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('Select', () => {
  it('renders its options and reports a change', () => {
    const onChange = vi.fn();
    render(
      <Select defaultValue="a" onChange={onChange} aria-label="pick">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );

    fireEvent.change(screen.getByLabelText('pick'), { target: { value: 'b' } });

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByLabelText('pick')).toHaveValue('b');
  });

  it('merges the caller className', () => {
    render(<Select className="w-32" aria-label="pick" />);
    expect(screen.getByLabelText('pick')).toHaveClass('rounded-xl', 'w-32');
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});

describe('Separator', () => {
  it('is horizontal by default', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toHaveClass('h-px', 'w-full');
  });

  it('can be vertical', () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.firstChild).toHaveClass('h-full', 'w-px');
  });

  it('forwards its ref and extra props', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Separator ref={ref} data-testid="sep" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(screen.getByTestId('sep')).toBeInTheDocument();
  });
});
