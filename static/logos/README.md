# Logo Images

Place your custom logo images in this folder to override the default Wikimedia URLs.

## Required Files

Add the following image files (PNG or SVG recommended):

- `grokipedia.png` (or `.svg`) - Logo for Grokipedia/xAI
- `britannica.png` (or `.svg`) - Logo for Encyclopedia Britannica  
- `wikipedia.png` (or `.svg`) - Logo for Wikipedia (optional, default works well)

## Recommended Dimensions

- Size: 200x200px (will be scaled down)
- Format: PNG with transparency or SVG
- Background: Transparent preferred

## After Adding Logos

Update `/src/lib/services/content.ts` to use local paths:

```typescript
export const SOURCE_LOGOS: Record<SourceSlug, string> = {
  wikipedia: '/logos/wikipedia.png',
  grokipedia: '/logos/grokipedia.png',
  britannica: '/logos/britannica.png',
};
```

## Current Default Sources

The app currently uses these Wikimedia-hosted logos:
- Wikipedia: Wikipedia puzzle globe
- Grokipedia: xAI logo (stylized X)
- Britannica: Thistle logo
