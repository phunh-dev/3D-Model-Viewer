import { Fragment, type ReactNode } from "react";
import { getLanguage, parseTemplate, t, useLanguage, type TextId } from "./index";

/**
 * Renders a text id whose placeholders are React elements, e.g.
 * `<Trans id="viewport.errorBody" values={{ name: <b>{file}</b> }} />`.
 */
export function Trans({ id, values }: { id: TextId; values: Record<string, ReactNode> }) {
  useLanguage();
  const parts = parseTemplate(t(id));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={`${getLanguage()}-${i}`}>{p.param !== undefined ? (values[p.param] ?? `{${p.param}}`) : p.text}</Fragment>
      ))}
    </>
  );
}
