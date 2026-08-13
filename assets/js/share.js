function buildShareUrls_(url, title) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return {
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    messenger: `https://www.facebook.com/dialog/send?link=${encodedUrl}&redirect_uri=${encodedUrl}&app_id=0`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
  };
}
function renderShareButtons(containerId, product, url) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const urls = buildShareUrls_(url, product.name);
  el.innerHTML = `
    <a href="${urls.whatsapp}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm" title="Share on WhatsApp">WhatsApp</a>
    <a href="${urls.facebook}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm" title="Share on Facebook">Facebook</a>
    <a href="${urls.messenger}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm" title="Share on Messenger">Messenger</a>
    <a href="${urls.telegram}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm" title="Share on Telegram">Telegram</a>
    <a href="${urls.linkedin}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm" title="Share on LinkedIn">LinkedIn</a>
    <a href="${urls.x}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm" title="Share on X">X</a>
    <button type="button" class="btn btn-outline btn-sm" onclick="copyShareLink('${url.replace(/'/g, "\\'")}')" title="Copy link">Copy link</button>
  `;
}
function copyShareLink(url) {
  navigator.clipboard.writeText(url).then(
    () => toast("Link copied", "success"),
    () => toast("Could not copy link", "error")
  );
}
