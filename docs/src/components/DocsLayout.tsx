import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getRecipesByCategory } from "../lib/content";

type DocsLayoutProps = {
  children: ReactNode;
};

export function DocsLayout({ children }: DocsLayoutProps) {
  const categories = getRecipesByCategory();

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>next-handler docs</h1>
        <p>Recipes for API errors, handler wrappers, and intl support.</p>
        <nav>
          <Link to="/recipes">All recipes</Link>
          {Object.entries(categories).map(([category, recipes]) => (
            <section key={category} className="category">
              <h2>{category}</h2>
              <ul>
                {recipes.map((recipe) => (
                  <li key={recipe.slug}>
                    <Link to={`/recipe/${recipe.slug}`}>{recipe.frontmatter.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
