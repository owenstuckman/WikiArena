<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { marked } from 'marked';
  
  export let content: string = '';
  export let class_: string = '';
  export let disableLinks: boolean = false; // New prop to disable link clicking
  
  const dispatch = createEventDispatcher();
  
  let renderedHtml = '';
  let container: HTMLDivElement;
  
  // Configure marked options
  marked.setOptions({
    breaks: true, // Convert \n to <br>
    gfm: true, // GitHub Flavored Markdown (includes tables)
  });
  
  // Custom renderer to open links in new tabs
  const renderer = new marked.Renderer();
  
  // Override link rendering
  const originalLink = renderer.link.bind(renderer);
  renderer.link = function(href: string | null, title: string | null | undefined, text: string) {
    if (!href) return text;
    
    const titleAttr = title ? ` title="${title}"` : '';
    // External links open in new tab with indicator
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // Add data attribute to identify as external link
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="external-link" data-href="${href}">${text}<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>`;
    }
    return `<a href="${href}"${titleAttr} data-href="${href}">${text}</a>`;
  };
  
  marked.use({ renderer });
  
  $: {
    try {
      renderedHtml = marked.parse(content) as string;
    } catch (e) {
      console.error('Markdown parsing error:', e);
      renderedHtml = content.replace(/\n/g, '<br>');
    }
  }
  
  // Handle link clicks when disabled
  function handleClick(e: MouseEvent) {
    if (!disableLinks) return;
    
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      dispatch('linkclick', { href: link.getAttribute('data-href') || link.getAttribute('href') });
    }
  }
  
  onMount(() => {
    if (container && disableLinks) {
      // Add disabled class to all links
      const links = container.querySelectorAll('a');
      links.forEach(link => {
        link.classList.add('link-disabled');
      });
    }
  });
  
  // Reactively update link states
  $: if (container) {
    const links = container.querySelectorAll('a');
    links.forEach(link => {
      if (disableLinks) {
        link.classList.add('link-disabled');
      } else {
        link.classList.remove('link-disabled');
      }
    });
  }
</script>

<div 
  class="markdown-content {class_}" 
  class:links-disabled={disableLinks}
  bind:this={container}
  on:click={handleClick}
  role="presentation"
>
  {@html renderedHtml}
</div>

<style>
  .markdown-content :global(h1) {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 1rem;
    color: #f1f5f9;
    border-bottom: 1px solid #334155;
    padding-bottom: 0.5rem;
  }
  
  .markdown-content :global(h2) {
    font-size: 1.35rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: #e2e8f0;
  }
  
  .markdown-content :global(h3) {
    font-size: 1.15rem;
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    color: #cbd5e1;
  }
  
  .markdown-content :global(h4) {
    font-size: 1rem;
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    color: #94a3b8;
  }
  
  .markdown-content :global(p) {
    margin-bottom: 1rem;
    line-height: 1.7;
    color: #cbd5e1;
  }
  
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
    color: #cbd5e1;
  }
  
  .markdown-content :global(li) {
    margin-bottom: 0.375rem;
    line-height: 1.6;
  }
  
  .markdown-content :global(ul li) {
    list-style-type: disc;
  }
  
  .markdown-content :global(ol li) {
    list-style-type: decimal;
  }
  
  .markdown-content :global(strong) {
    font-weight: 600;
    color: #f1f5f9;
  }
  
  .markdown-content :global(em) {
    font-style: italic;
    color: #94a3b8;
  }
  
  .markdown-content :global(code) {
    background: #1e293b;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'Fira Code', 'Monaco', monospace;
    font-size: 0.875em;
    color: #fbbf24;
  }
  
  .markdown-content :global(pre) {
    background: #1e293b;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }
  
  .markdown-content :global(pre code) {
    padding: 0;
    background: none;
  }
  
  .markdown-content :global(blockquote) {
    border-left: 3px solid #fbbf24;
    padding-left: 1rem;
    margin: 1rem 0;
    color: #94a3b8;
    font-style: italic;
  }
  
  .markdown-content :global(hr) {
    border: none;
    border-top: 1px solid #334155;
    margin: 1.5rem 0;
  }
  
  /* Link styles */
  .markdown-content :global(a) {
    color: #fbbf24;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.15s ease;
  }
  
  .markdown-content :global(a:hover) {
    color: #fcd34d;
  }
  
  /* Disabled link styles */
  .markdown-content.links-disabled :global(a),
  .markdown-content :global(a.link-disabled) {
    cursor: not-allowed;
    opacity: 0.7;
    pointer-events: auto; /* Keep clickable for event handling */
  }
  
  .markdown-content.links-disabled :global(a:hover),
  .markdown-content :global(a.link-disabled:hover) {
    color: #fbbf24;
    text-decoration: underline dotted;
  }
  
  /* External link indicator */
  .markdown-content :global(.external-link) {
    display: inline;
  }
  
  .markdown-content :global(.external-icon) {
    display: inline-block;
    width: 0.75em;
    height: 0.75em;
    margin-left: 0.2em;
    vertical-align: baseline;
    opacity: 0.7;
  }
  
  .markdown-content :global(a:hover .external-icon) {
    opacity: 1;
  }

  /* Enhanced Table Styles */
  .markdown-content :global(.table-wrapper) {
    overflow-x: auto;
    margin-bottom: 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid #334155;
  }
  
  .markdown-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .markdown-content :global(thead) {
    background: linear-gradient(to bottom, #1e293b, #0f172a);
  }
  
  .markdown-content :global(th) {
    border: 1px solid #334155;
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
  }
  
  .markdown-content :global(td) {
    border: 1px solid #334155;
    padding: 0.5rem 1rem;
    text-align: left;
    color: #cbd5e1;
    vertical-align: top;
  }
  
  .markdown-content :global(tbody tr:nth-child(odd)) {
    background: #0f172a;
  }
  
  .markdown-content :global(tbody tr:nth-child(even)) {
    background: #1e293b;
  }
  
  .markdown-content :global(tbody tr:hover) {
    background: #334155;
  }
  
  /* Medal colors for sports tables */
  .markdown-content :global(td:first-child) {
    font-weight: 500;
  }
  
  /* Totals row */
  .markdown-content :global(tbody tr:last-child) {
    font-weight: 600;
    background: #1e293b;
  }
  
  /* Responsive tables */
  @media (max-width: 640px) {
    .markdown-content :global(table) {
      font-size: 0.8rem;
    }
    
    .markdown-content :global(th),
    .markdown-content :global(td) {
      padding: 0.375rem 0.5rem;
    }
  }
</style>
