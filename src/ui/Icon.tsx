type Name = 'book' | 'plus' | 'arrow' | 'close' | 'search' | 'file' | 'edit' | 'back' | 'next' | 'check' | 'settings';
const paths: Record<Name, string> = {
  settings: 'M4 7h8m4 0h4M4 17h3m4 0h9M12 4v6m-5 4v6',
  book: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5Z',
  plus: 'M12 5v14M5 12h14', arrow: 'M5 12h14m-6-6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6', search: 'm16 16 4 4M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  file: 'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h6',
  edit: 'm15 4 5 5-11 11H4v-5L15 4Zm-1 1 5 5',
  back: 'm15 5-7 7 7 7', next: 'm9 5 7 7-7 7', check: 'm5 12 4 4L19 6',
};

export function Icon({ name, size = 20 }: { name: Name; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
