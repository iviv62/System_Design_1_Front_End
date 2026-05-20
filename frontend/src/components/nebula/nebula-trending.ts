import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Article } from "../../types/article";
import "./nebula-article-card";

const SAMPLE_ARTICLES: Article[] = [
  {
    id: 1,
    title: "Building Real-Time Collaborative Canvases",
    excerpt:
      "Explore how WebRTC and CRDTs combine to enable seamless multi-user code execution environments...",
    author: "Alice Mercer",
    authorId: undefined,
    tag: "ENGINEERING",
    tagColor: "#4f8ef7",
    stars: 312,
    readTime: "6 min read",
    coverUrl:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=150&fit=crop&q=80",
    starred: false,
  },
  {
    id: 2,
    title: "The Rise of Pixel Art in Modern Games",
    excerpt:
      "From indie gems to blockbuster titles, pixel art is making a massive comeback in the gaming world...",
    author: "Ben Clarke",
    authorId: undefined,
    tag: "ART",
    tagColor: "#e05c5c",
    stars: 198,
    readTime: "4 min read",
    coverUrl:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=150&fit=crop&q=80",
    starred: false,
  },
];

@customElement("nebula-trending")
export class NebulaTrending extends LitElement {
  // Light DOM is used project-wide so global SCSS class selectors apply without
  // Shadow DOM piercing. Scoping is handled purely by BEM-style class names.
  createRenderRoot() {
    return this;
  }

  @state() private articles: Article[] = SAMPLE_ARTICLES;

  private handleArticleStar(
    e: CustomEvent<{ id: number; starred: boolean; stars: number }>
  ) {
    // Keep both `starred` and `stars` in sync so the next prop pass from the
    // parent does not reset the child's displayed count after an API refresh.
    this.articles = this.articles.map((a) =>
      a.id === e.detail.id
        ? { ...a, starred: e.detail.starred, stars: e.detail.stars }
        : a
    );
  }

  render() {
    return html`
      <section>
        <div class="section-header">
          <h3>Popular Articles</h3>
        </div>
        <div class="trending-grid">
          ${this.articles.map(
            (article) => html`
              <nebula-article-card
                .article=${article}
                @article-star=${this.handleArticleStar}
              ></nebula-article-card>
            `
          )}
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-trending": NebulaTrending;
  }
}
