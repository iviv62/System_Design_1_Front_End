import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { PropertyValues } from "lit";
import type { Article } from "../../types/article";
import { navigate } from "../../utils/navigate";

@customElement("nebula-article-card")
export class NebulaArticleCard extends LitElement {
  // Light DOM is used project-wide so global SCSS class selectors apply without
  // Shadow DOM piercing. Scoping is handled purely by BEM-style class names.
  createRenderRoot() {
    return this;
  }

  @property({ type: Object }) article!: Article;

  @state() private starred = false;
  @state() private starCount = 0;

  willUpdate(changed: PropertyValues<this>) {
    // Only initialise local state on the first render (when there is no previous
    // value for `article`). Subsequent parent-driven updates will already carry
    // the synced stars/starred values from handleArticleStar in the parent.
    if (changed.has("article" as keyof this) && !changed.get("article" as keyof this)) {
      this.starred = this.article.starred;
      this.starCount = this.article.stars;
    }
  }

  private openArticle() {
    navigate(`/article/${this.article.id}`);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.openArticle();
    }
  }

  private handleStar(e: Event) {
    e.stopPropagation();
    this.starred = !this.starred;
    this.starCount += this.starred ? 1 : -1;
    this.dispatchEvent(
      new CustomEvent("article-star", {
        bubbles: true,
        composed: true,
        detail: { id: this.article.id, starred: this.starred, stars: this.starCount },
      })
    );
  }

  render() {
    return html`
      <div
        class="trending-card article-card"
        role="article"
        tabindex="0"
        @click=${this.openArticle}
        @keydown=${this.handleKeyDown}
      >
        <div
          class="card-banner"
          style="background: url('${this.article.coverUrl}') center/cover"
        >
          <div class="tags">
            <span
              class="tag"
              style="background-color: ${this.article.tagColor}"
            >${this.article.tag}</span>
          </div>
        </div>
        <div class="card-body">
          <h4>${this.article.title}</h4>
          <p>${this.article.excerpt}</p>
          <div class="card-footer">
            <span class="members article-meta">
              <span class="author-dot"></span>
              ${this.article.author} &middot; ${this.article.readTime}
            </span>
            <button
              class="btn-star ${this.starred ? "starred" : ""}"
              @click=${this.handleStar}
              title="${this.starred ? "Unstar" : "Star"} article"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="${this.starred ? "currentColor" : "none"}"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              ${this.starCount}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-article-card": NebulaArticleCard;
  }
}
