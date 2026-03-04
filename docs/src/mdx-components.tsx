import type { AnchorHTMLAttributes, PropsWithChildren } from "react";
import { Link as RouterLink } from "react-router-dom";

function CodeBlock({ children }: PropsWithChildren) {
  return <pre>{children}</pre>;
}

export const mdxComponents = {
  a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const href = props.href ?? "";
    if (href.startsWith("http")) {
      return <a {...props} target="_blank" rel="noreferrer" />;
    }
    if (href.startsWith("/")) {
      return <RouterLink to={href}>{props.children}</RouterLink>;
    }
    return <a {...props} />;
  },
  pre: CodeBlock,
};
