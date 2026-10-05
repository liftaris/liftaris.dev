// Astro owns persistence and swapping. Empty route placeholders must not replace
// a newly rendered desktop when the first visit was directly to a content page.
// Editing also gets a fresh island, including when edit mode changes en route.
document.addEventListener('astro:before-swap', event => {
  const desktop = document.querySelector<HTMLElement>('[data-persisted-desktop]');
  if (desktop && (!desktop.querySelector('.house') || desktop.querySelector('[data-edit-mode=true]') || event.newDocument.querySelector('[data-edit-mode=true]'))) {
    desktop.removeAttribute('data-astro-transition-persist');
  }
  // Match the full-page window to its existing desktop window for Astro's
  // return animation. The browser animates snapshots; the live iframe stays put.
  if (event.to.pathname !== '/' || !desktop) return;
  const id = new URLSearchParams(event.to.hash.slice(1)).get('restore');
  if (!id) return;
  const frame = desktop.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]:not(.hide)`);
  if (!frame) return;
  const header = frame.querySelector<HTMLElement>('.wb-header');
  frame.style.viewTransitionName = 'site-window';
  if (header) header.style.viewTransitionName = 'window-titlebar';
  const clear = () => {
    frame.style.removeProperty('view-transition-name');
    header?.style.removeProperty('view-transition-name');
  };
  void event.viewTransition.finished.then(clear, clear);
});

function updateDesktop() {
  const desktop = document.querySelector<HTMLElement>('[data-persisted-desktop]');
  if (!desktop) return;
  const hidden = !document.documentElement.classList.contains('on-home');
  desktop.inert = hidden;
  desktop.setAttribute('aria-hidden', String(hidden));
}

updateDesktop();
document.addEventListener('astro:after-swap', updateDesktop);
