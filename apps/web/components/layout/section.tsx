import * as React from "react";
import { cn } from "@/lib/utils";
import { Container } from "./container";

export interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header row (link, button sm, toolbar). */
  action?: React.ReactNode;
}

/**
 * App section: header row + body with gap-4. Sibling Sections are spaced by
 * the AppShell content column (gap-8); never add margins.
 */
export function Section({ title, description, action, className, children, ...props }: SectionProps) {
  const hasHeader = title || description || action;
  return (
    <section className={cn("flex min-w-0 flex-col gap-4", className)} {...props}>
      {hasHeader && (
        <div className="flex min-h-8 flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            {title && <h2 className="type-heading text-ink">{title}</h2>}
            {description && <p className="type-small max-w-[64ch] text-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export interface MarketingSectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Display headline (type-display). */
  title?: React.ReactNode;
  /** Lead paragraph shown right of the title on lg+, below it on smaller screens. */
  lead?: React.ReactNode;
  /** Optional element under the lead (link, button). */
  action?: React.ReactNode;
  tone?: "default" | "wash";
  /** Hairline above the section. Default true. */
  rule?: boolean;
  width?: "marketing" | "prose";
  bodyClassName?: string;
}

/**
 * Marketing section: py-20 md:py-32, hairline top rule, 1400 container,
 * editorial split header (title 7 cols, lead 5 cols) then body with mt-12 md:mt-16.
 */
export function MarketingSection({
  title,
  lead,
  action,
  tone = "default",
  rule = true,
  width = "marketing",
  className,
  bodyClassName,
  children,
  ...props
}: MarketingSectionProps) {
  const hasHeader = title || lead;
  return (
    <section
      className={cn("relative scroll-mt-16 py-20 md:py-32", rule && "border-t border-rule", tone === "wash" && "bg-paper", className)}
      {...props}
    >
      <Container width={width}>
        {hasHeader && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
            {title && <h2 className="type-display text-ink lg:col-span-7">{title}</h2>}
            {(lead || action) && (
              <div className="flex flex-col items-start gap-6 lg:col-span-5 lg:pb-2">
                {lead && <p className="type-body-lg max-w-[52ch] text-muted">{lead}</p>}
                {action}
              </div>
            )}
          </div>
        )}
        {children && <div className={cn(hasHeader && "mt-12 md:mt-16", bodyClassName)}>{children}</div>}
      </Container>
    </section>
  );
}
