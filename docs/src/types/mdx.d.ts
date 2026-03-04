declare module "*.mdx" {
  import type { ComponentType } from "react";

  const Component: ComponentType;
  export const frontmatter: {
    title: string;
    description: string;
    category: string;
    tags?: string[];
    difficulty?: "beginner" | "intermediate" | "advanced";
    updatedAt?: string;
  };
  export default Component;
}
