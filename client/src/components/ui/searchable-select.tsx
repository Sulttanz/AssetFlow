import * as React from "react";
import { SearchableCombobox, type SearchableComboboxOption } from "./searchable-combobox";

function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    return React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : "";
  }).join("");
}

function optionsFrom(children: React.ReactNode): SearchableComboboxOption[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<React.ComponentPropsWithoutRef<"option">>(child)) return [];
    if (child.type === "option") {
      const label = text(child.props.children);
      return [{ value: String(child.props.value ?? label), label, disabled: child.props.disabled }];
    }
    return optionsFrom(child.props.children);
  });
}

/**
 * Native-select adapter for legacy forms: keeps actual form values, required
 * validation, refs and change events while presenting the shared combobox.
 * Small fixed-choice controls can continue using the browser's native select.
 */
export const SearchableSelect = React.forwardRef<HTMLSelectElement, Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "multiple">>(
  function SearchableSelect({ children, value, defaultValue, onChange, className, id, onInvalid, ...props }, forwardedRef) {
    const native = React.useRef<HTMLSelectElement | null>(null);
    const trigger = React.useRef<HTMLButtonElement>(null);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(String(defaultValue ?? ""));
    const [validation, setValidation] = React.useState("");
    const options = optionsFrom(children);
    const selectedValue = String(value ?? uncontrolledValue);
    const errorId = React.useId();
    return (
      <>
        <select
          {...props}
          data-testid={undefined}
          aria-hidden="true"
          aria-label={undefined}
          aria-labelledby={undefined}
          tabIndex={-1}
          className="sr-only"
          ref={node => {
            native.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          value={selectedValue}
          onChange={event => {
            setUncontrolledValue(event.target.value);
            setValidation("");
            onChange?.(event);
          }}
          onInvalid={event => {
            onInvalid?.(event);
            if (!event.defaultPrevented) {
              event.preventDefault();
              setValidation(event.currentTarget.validationMessage);
              trigger.current?.focus();
            }
          }}
        >{children}</select>
        <SearchableCombobox
          ref={trigger}
          id={id}
          ariaLabel={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={[props["aria-describedby"], validation ? errorId : ""].filter(Boolean).join(" ") || undefined}
          aria-required={props.required}
          aria-invalid={validation ? true : props["aria-invalid"]}
          disabled={props.disabled}
          className={className}
          data-testid={(props as Record<string, unknown>)["data-testid"]}
          onBlur={props.onBlur ? () => native.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true })) : undefined}
          options={options}
          value={selectedValue}
          onChange={next => {
            if (!native.current) return;
            const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
            setValue?.call(native.current, next);
            native.current.dispatchEvent(new Event("change", { bubbles: true }));
          }}
        />
        {validation && <span id={errorId} role="alert" className="text-sm text-destructive">{validation}</span>}
      </>
    );
  },
);
