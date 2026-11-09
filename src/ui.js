/*! @codemaku/arcade/ui — the small dialog helpers the players and matches screens share. © 2026 Codemaku. */

export const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** A kit sheet: the arcade overlay with a card and a title. */
export function sheet(title) {
  const ov = el("div", "arcade-overlay ah-install arcade-players");
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-label", title);
  ov.style.display = "flex";
  const card = el("div", "card");
  card.append(el("h2", null, title));
  ov.append(card);
  document.body.append(ov);
  return { ov, card, close: () => ov.remove() };
}

export function button(label, kind, onClick) {
  const b = el("button", `btn${kind ? ` ${kind}` : ""}`, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
