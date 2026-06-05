'use client';

/**
 * 20ui — Form.
 *
 * react-hook-form wrappers that pair with the 20ui Field / Input primitives.
 * They reproduce the Field a11y contract (generated ids, `htmlFor`,
 * `aria-describedby`, `aria-invalid`) but drive `invalid` + the error message
 * straight off RHF's field state, so a controlled field is fully labelled,
 * described, and announced with zero prop threading.
 *
 * Composition mirrors the well-known shadcn form pattern:
 *
 *   <Form {...methods}>
 *     <form onSubmit={methods.handleSubmit(onSubmit)}>
 *       <FormField
 *         control={methods.control}
 *         name="email"
 *         render={({ field }) => (
 *           <FormItem>
 *             <FormLabel>Work email</FormLabel>
 *             <FormControl>
 *               <Input type="email" placeholder="jordan@acme.com" {...field} />
 *             </FormControl>
 *             <FormDescription>We never share this.</FormDescription>
 *             <FormMessage />
 *           </FormItem>
 *         )}
 *       />
 *     </form>
 *   </Form>
 *
 * `FormControl` clones the single child it wraps and injects `id` +
 * `aria-describedby` + `aria-invalid`, so any native control (or a 20ui Input
 * that forwards those props) is wired automatically.
 */

import * as React from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

import './form.css';
// Reuse the Field label / help / error styling so Form and Field look identical.
import './field.css';

/**
 * `Form` is RHF's `FormProvider`. Spread your `useForm()` return into it:
 * `<Form {...methods}>…</Form>`.
 */
export const Form = FormProvider;

// ----- per-field id context -----------------------------------------------

interface FormFieldContextValue {
  name: string;
}
const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

interface FormItemContextValue {
  id: string;
}
const FormItemContext = React.createContext<FormItemContextValue | null>(null);

/**
 * Read the current field's a11y wiring (ids + RHF state). Used internally by
 * `FormLabel` / `FormControl` / `FormDescription` / `FormMessage`, and exported
 * for building custom controls that need the same ids.
 */
export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  // Subscribe to form state so error / touched changes re-render consumers.
  const formState = useFormState({ name: fieldContext?.name });

  if (!fieldContext) {
    throw new Error('useFormField must be used within a <FormField>.');
  }
  if (!itemContext) {
    throw new Error('useFormField must be used within a <FormItem>.');
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    name: fieldContext.name,
    formItemId: `${id}-control`,
    formDescriptionId: `${id}-description`,
    formMessageId: `${id}-message`,
    ...fieldState,
  };
}

// ----- FormField (Controller) ----------------------------------------------

/**
 * Wraps RHF's `Controller` and publishes the field name to the subtree so the
 * child components can resolve its ids and error state. Pass `control`, `name`,
 * `rules`, and a `render` prop exactly as you would to `Controller`.
 */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>): React.JSX.Element {
  const value = React.useMemo<FormFieldContextValue>(() => ({ name: props.name }), [props.name]);
  return (
    <FormFieldContext.Provider value={value}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

// ----- FormItem ------------------------------------------------------------

export interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {}

/** The field wrapper: stacks label, control, description, and message. */
export const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  function FormItem({ className, ...rest }, ref) {
    const auto = React.useId();
    const value = React.useMemo<FormItemContextValue>(() => ({ id: `f-${auto}` }), [auto]);
    return (
      <FormItemContext.Provider value={value}>
        <div ref={ref} className={['u-field', className].filter(Boolean).join(' ')} {...rest} />
      </FormItemContext.Provider>
    );
  },
);

// ----- FormLabel -----------------------------------------------------------

export interface FormLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Render a red required marker after the label text. */
  required?: boolean;
}

/** A `<label>` bound to the field control, reddened when the field is invalid. */
export const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  function FormLabel({ className, required, children, ...rest }, ref) {
    const { error, formItemId } = useFormField();
    return (
      <label
        ref={ref}
        htmlFor={formItemId}
        data-invalid={error ? '' : undefined}
        className={['u-field__label', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
        {required ? (
          <span className="u-field__req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
    );
  },
);

// ----- FormControl ---------------------------------------------------------

export interface FormControlProps {
  /** The single control element to wire (e.g. a 20ui `<Input>` or native input). */
  children: React.ReactElement;
}

/**
 * Clones its single child and injects `id`, `aria-describedby`, and
 * `aria-invalid` from the field state. Any explicit props on the child win, so
 * an existing `aria-describedby` is preserved and merged.
 */
export function FormControl({ children }: FormControlProps): React.JSX.Element {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  const child = React.Children.only(children) as React.ReactElement<
    Record<string, unknown>
  >;
  const childProps = child.props;

  const describedBy =
    [
      error ? formMessageId : formDescriptionId,
      typeof childProps['aria-describedby'] === 'string'
        ? (childProps['aria-describedby'] as string)
        : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return React.cloneElement(child, {
    id: (childProps.id as string | undefined) ?? formItemId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : (childProps['aria-invalid'] as boolean | undefined),
    // 20ui Input/Textarea read `invalid` to paint the danger border.
    invalid: error ? true : childProps.invalid,
  });
}

// ----- FormDescription -----------------------------------------------------

export interface FormDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

/** Helper text under the control, referenced by the control's `aria-describedby`. */
export const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  FormDescriptionProps
>(function FormDescription({ className, ...rest }, ref) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={['u-field__help', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

// ----- FormMessage ---------------------------------------------------------

export interface FormMessageProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

/**
 * The validation message. Renders the RHF error message when present, otherwise
 * falls back to `children`. Returns null when there is nothing to say, so it can
 * be left mounted unconditionally.
 */
export const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  FormMessageProps
>(function FormMessage({ className, children, ...rest }, ref) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? '') : children;

  if (!body) return null;

  return (
    <p
      ref={ref}
      id={formMessageId}
      role="alert"
      className={['u-field__error', 'u-form-message', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {body}
    </p>
  );
});

export default Form;
