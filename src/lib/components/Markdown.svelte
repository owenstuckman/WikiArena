<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  
  export let content: string = '';
  export let class_: string = '';
  
  let renderedHtml = '';
  
  // Configure marked options
  marked.setOptions({
    breaks: true, // Convert \n to <br>
    gfm: true, // GitHub Flavored Markdown
  });
  
  $: {
    try {
      renderedHtml = marked.parse(content) as string;
    } catch (e) {
      console.error('Markdown parsing error:', e);
      renderedHtml = content.replace(/\n/g, '<br>');
    }
  }
</script>

<div class="markdown-content {class_}">
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
  
  .markdown-content :global(a) {
    color: #fbbf24;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  
  .markdown-content :global(a:hover) {
    color: #fcd34d;
  }
  
  .markdown-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }
  
  .markdown-content :global(th),
  .markdown-content :global(td) {
    border: 1px solid #334155;
    padding: 0.5rem 0.75rem;
    text-align: left;
  }
  
  .markdown-content :global(th) {
    background: #1e293b;
    font-weight: 600;
  }
</style>
