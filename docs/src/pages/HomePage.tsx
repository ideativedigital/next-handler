import { Link } from "react-router-dom";
import { DocsLayout } from "../components/DocsLayout";
import { getAllRecipes } from "../lib/content";

export function HomePage() {
  const recipes = getAllRecipes();

  return (
    <DocsLayout>
      <header className="page-header">
        <h1>All recipes</h1>
        <p>A minimal recipe collection mirroring the mongo-collections docs style.</p>
      </header>
      <div className="card-grid">
        {recipes.map((recipe) => (
          <article className="card" key={recipe.slug}>
            <span className="pill">{recipe.frontmatter.category}</span>
            <h2>{recipe.frontmatter.title}</h2>
            <p>{recipe.frontmatter.description}</p>
            <Link className="card-link" to={`/recipe/${recipe.slug}`}>
              Open recipe
            </Link>
          </article>
        ))}
      </div>
    </DocsLayout>
  );
}
