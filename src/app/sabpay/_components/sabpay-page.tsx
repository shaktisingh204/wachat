/**
 * SabpayPage — the ONE page container every SabPay page renders inside.
 *
 * Clone of the proven WachatPage frame (one max width, one responsive
 * gutter, one header→body rhythm) so SabPay inherits the module
 * consistency WaChat fought for. See wachat-page.tsx for the rationale.
 */

import * as React from 'react';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

import './sabpay-page.css';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type SabpayPageWidth = 'default' | 'narrow' | 'wide';

/** One crumb in the page's breadcrumb trail. */
export interface SabpayCrumb {
  label: React.ReactNode;
  /** Link target for non-current crumbs; omit for the current page. */
  href?: string;
}

export interface SabpayPageProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  breadcrumb?: SabpayCrumb[];
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  bordered?: boolean;
  width?: SabpayPageWidth;
  variant?: 'default' | 'app';
  contentClassName?: string;
  children?: React.ReactNode;
}

export function SabpayPage({
  breadcrumb,
  eyebrow,
  title,
  description,
  actions,
  bordered = true,
  width = 'default',
  variant = 'default',
  className,
  contentClassName,
  children,
  ...rest
}: SabpayPageProps): React.JSX.Element {
  if (variant === 'app') {
    return (
      <div className={cx('ui20', 'sabpay-page', 'sabpay-page--app', className)} {...rest}>
        {children}
      </div>
    );
  }

  const hasHeader = Boolean(eyebrow || title || description || actions);

  return (
    <div className={cx('ui20', 'sabpay-page', className)} {...rest}>
      <div className={cx('sabpay-page__inner', contentClassName)} data-width={width}>
        {breadcrumb && breadcrumb.length > 0 ? (
          <Breadcrumb className="sabpay-page__crumbs">
            <BreadcrumbList>
              {breadcrumb.map((crumb, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <React.Fragment key={i}>
                    <BreadcrumbItem>
                      {crumb.href && !isLast ? (
                        <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {!isLast ? <BreadcrumbSeparator /> : null}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}

        {hasHeader ? (
          <PageHeader bordered={bordered}>
            <PageHeaderHeading>
              {eyebrow ? <PageEyebrow>{eyebrow}</PageEyebrow> : null}
              {title ? <PageTitle>{title}</PageTitle> : null}
              {description ? <PageDescription>{description}</PageDescription> : null}
            </PageHeaderHeading>
            {actions ? <PageActions>{actions}</PageActions> : null}
          </PageHeader>
        ) : null}

        <div className={cx('sabpay-page__body', hasHeader && 'sabpay-page__body--after-header')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default SabpayPage;
