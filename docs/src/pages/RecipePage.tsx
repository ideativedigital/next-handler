import { Link, Navigate, useParams } from "react-router-dom";
import { DocsLayout } from "../components/DocsLayout";
import { getRecipeBySlug } from "../lib/content";

export function RecipePage() {
  const { slug = "" } = useParams();
  const recipe = getRecipeBySlug(slug);

  if (!recipe) return <Navigate to="/recipes" replace />;

  const RecipeComponent = recipe.Component;

  return (
    <DocsLayout>
      <article>
        <header className="page-header">
          <span className="pill">{recipe.frontmatter.category}</span>
          <h1>{recipe.frontmatter.title}</h1>
          <p>{recipe.frontmatter.description}</p>
          <Link to="/recipes">Back to all recipes</Link>
        </header>
        <RecipeComponent />
      </article>
    </DocsLayout>
  );
}
