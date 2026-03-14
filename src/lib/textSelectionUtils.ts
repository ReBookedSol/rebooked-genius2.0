/**
 * Utility functions for handling text selection and creating annotations
 */

export interface TextSelection {
  text: string;
  position: number;
  x: number;
  y: number;
}

/**
 * Get the currently selected text and its position in the DOM
 */
export function getTextSelection(): TextSelection | null {
  const selection = window.getSelection();

  if (!selection || selection.toString().length === 0) {
    return null;
  }

  const text = selection.toString();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Get approximate position within text
  const container = range.commonAncestorContainer;
  const position = range.startOffset;

  return {
    text: text.trim(),
    position,
    x: rect.left,
    y: rect.top,
  };
}

/**
 * Clear the current text selection
 */
export function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

/**
 * Highlight selected text with a specific color
 */
export function highlightSelectedText(color: string, isComment: boolean = false, commentText: string = ''): void {
  const selection = window.getSelection();

  if (!selection || selection.toString().length === 0) {
    return;
  }

  const range = selection.getRangeAt(0);

  const createSpan = () => {
    const span = document.createElement('span');
    if (isComment) {
      span.className = 'lesson-highlight has-comment';
      span.setAttribute('data-comment', commentText);
      span.style.borderBottom = '2px dotted #10b981';
      span.style.cursor = 'pointer';
      span.style.paddingBottom = '1px';
    } else {
      span.style.backgroundColor = color;
      span.style.padding = '2px 0';
      span.style.borderRadius = '2px';
      span.style.cursor = 'default';
      span.className = 'lesson-highlight';
      span.setAttribute('data-highlight-color', color);
    }
    return span;
  };

  try {
    // Try the simple way first
    const span = createSpan();
    range.surroundContents(span);
  } catch (error) {
    // If surroundContents fails (usually because of cross-node selection),
    // use a more robust approach by wrapping text nodes individually
    console.warn('surroundContents failed, using robust highlight method');

    try {
      const fragment = range.extractContents();

      // Function to wrap text nodes in a fragment
      const wrapTextNodes = (container: Node) => {
        const children = Array.from(container.childNodes);
        children.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
            const span = createSpan();
            const parent = child.parentNode;
            if (parent) {
              parent.replaceChild(span, child);
              span.appendChild(child);
            }
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            wrapTextNodes(child);
          }
        });
      };

      wrapTextNodes(fragment);

      const wrapper = document.createElement('span');
      wrapper.className = 'lesson-highlight-container';
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
    } catch (fallbackError) {
      console.error('Error highlighting text with robust method:', fallbackError);
    }
  }

  // Clear selection after highlighting
  selection.removeAllRanges();
}

/**
 * Remove all highlights from a container
 */
export function removeAllHighlights(container: HTMLElement): void {
  const highlights = container.querySelectorAll('.lesson-highlight, .lesson-highlight-container');
  highlights.forEach((highlight) => {
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent?.insertBefore(highlight.firstChild, highlight);
    }
    parent?.removeChild(highlight);
  });
}

/**
 * Get HTML content with preserved formatting
 */
export function getFormattedContent(element: HTMLElement): string {
  return element.innerHTML;
}

/**
 * Restore HTML content (including highlights and formatting)
 */
export function setFormattedContent(element: HTMLElement, html: string): void {
  element.innerHTML = html;
}
