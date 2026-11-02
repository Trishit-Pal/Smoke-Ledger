// Figures in prose, in any script. Replies mirror the reader's language, so a
// figure may arrive as "१,२००" as easily as "1,200". One pattern serves both the
// discreet mask (which hides every figure) and the narration guard (which checks
// every figure), so what one sees the other sees.

/** A figure with optional grouping (1,200 · 1,00,000 · 1 200) and decimals, in any decimal-digit script. */
export const FIGURE_SOURCE = String.raw`\p{Nd}+(?:[,   ]\p{Nd}{2,3})*(?:\.\p{Nd}+)?`;

/**
 * Zero code points of the decimal-digit blocks the product's readers may write in:
 * Arabic-Indic, Extended Arabic-Indic, Devanagari, Bengali, Gurmukhi, Gujarati,
 * Oriya, Tamil, Telugu, Kannada, Malayalam, and fullwidth.
 */
const ZEROS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10];

/**
 * Maps digits from the blocks above to ASCII, one character for one, so match
 * positions are unchanged. Digits from any other script are left as they are;
 * callers that need a value treat those as unreadable.
 */
export function toAsciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (d) => {
    const c = d.codePointAt(0) ?? 0;
    const zero = ZEROS.find((z) => c >= z && c <= z + 9);
    return zero == null ? d : String(c - zero);
  });
}
