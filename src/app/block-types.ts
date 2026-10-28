export type BlockType =
  | 'hero'
  | 'heading'
  | 'image'
  | 'button'
  | 'faq'
  | 'gallery'
  | 'carousel'
  | 'fullHero'
  | 'imageText'
  | 'bento'
  | 'fab';

export interface FieldDef {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'url' | 'image' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface BlockDef {
  type: BlockType;
  title: string;
  description: string;
  defaults: Record<string, string>;
  /** Generic editor fields. Legacy blocks (hero, heading, image, button) use hand-written templates instead. */
  fields: FieldDef[];
  /** Repeatable entries, stored as a JSON array in the block's `items` field. */
  itemLabel?: string;
  itemFields?: FieldDef[];
  itemDefaults?: Record<string, string>;
  generic: boolean;
}

export type BlockItem = Record<string, string>;

const POSITION = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
];

export const BLOCK_DEFS: BlockDef[] = [
  {
    type: 'hero', title: 'Hero section', description: 'A featured headline and call to action', generic: false,
    defaults: { title: 'A bold headline', subtitle: 'Add a short supporting message.', buttonLabel: 'Get started', buttonUrl: '', imageUrl: '' },
    fields: [],
  },
  {
    type: 'fullHero', title: 'Full image hero', description: 'A full-width image with overlaid text', generic: true,
    defaults: { imageUrl: '', alt: '', title: 'A bold headline', subtitle: 'Add a short supporting message.', buttonLabel: 'Get started', buttonUrl: '', overlay: '40', align: 'center', height: '70' },
    fields: [
      { key: 'imageUrl', label: 'Image', kind: 'image' },
      { key: 'alt', label: 'Image description', kind: 'text' },
      { key: 'title', label: 'Headline', kind: 'text' },
      { key: 'subtitle', label: 'Supporting text', kind: 'textarea' },
      { key: 'buttonLabel', label: 'Button label', kind: 'text' },
      { key: 'buttonUrl', label: 'Button URL', kind: 'url' },
      { key: 'overlay', label: 'Dark overlay', kind: 'select', options: [0, 20, 40, 60, 80].map((v) => ({ value: `${v}`, label: `${v}%` })) },
      { key: 'align', label: 'Text alignment', kind: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
      { key: 'height', label: 'Height', kind: 'select', options: [{ value: '50', label: 'Medium' }, { value: '70', label: 'Tall' }, { value: '100', label: 'Full screen' }] },
    ],
  },
  {
    type: 'heading', title: 'Heading & text', description: 'An eyebrow, heading, and body copy', generic: false,
    defaults: { eyebrow: '', text: 'Your heading', body: 'Add your content here.' },
    fields: [],
  },
  {
    type: 'image', title: 'Image', description: 'An image with alt text and a caption', generic: false,
    defaults: { url: '', alt: '', caption: '' },
    fields: [],
  },
  {
    type: 'imageText', title: 'Image with text', description: 'A picture beside a heading, text and button', generic: true,
    defaults: { imageUrl: '', alt: '', eyebrow: '', heading: 'Tell your story', body: 'Add your content here.', buttonLabel: '', buttonUrl: '', imagePosition: 'left' },
    fields: [
      { key: 'imageUrl', label: 'Image', kind: 'image' },
      { key: 'alt', label: 'Image description', kind: 'text' },
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'body', label: 'Body text', kind: 'textarea' },
      { key: 'buttonLabel', label: 'Button label (optional)', kind: 'text' },
      { key: 'buttonUrl', label: 'Button URL', kind: 'url' },
      { key: 'imagePosition', label: 'Image position', kind: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
    ],
  },
  {
    type: 'gallery', title: 'Gallery', description: 'A grid of images with captions', generic: true,
    defaults: { title: '', columns: '3', items: '[]' },
    fields: [
      { key: 'title', label: 'Title (optional)', kind: 'text' },
      { key: 'columns', label: 'Columns', kind: 'select', options: ['2', '3', '4'].map((v) => ({ value: v, label: v })) },
    ],
    itemLabel: 'Image',
    itemFields: [
      { key: 'url', label: 'Image', kind: 'image' },
      { key: 'alt', label: 'Image description', kind: 'text' },
      { key: 'caption', label: 'Caption', kind: 'text' },
    ],
    itemDefaults: { url: '', alt: '', caption: '' },
  },
  {
    type: 'carousel', title: 'Carousel', description: 'Sliding images with optional text', generic: true,
    defaults: { autoplay: 'true', interval: '5', items: '[]' },
    fields: [
      { key: 'autoplay', label: 'Autoplay', kind: 'select', options: [{ value: 'true', label: 'On' }, { value: 'false', label: 'Off' }] },
      { key: 'interval', label: 'Seconds per slide', kind: 'select', options: ['3', '5', '8', '10'].map((v) => ({ value: v, label: v })) },
    ],
    itemLabel: 'Slide',
    itemFields: [
      { key: 'url', label: 'Image', kind: 'image' },
      { key: 'alt', label: 'Image description', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'text', label: 'Text', kind: 'textarea' },
    ],
    itemDefaults: { url: '', alt: '', title: '', text: '' },
  },
  {
    type: 'bento', title: 'Bento grid', description: 'Mixed-size feature tiles', generic: true,
    defaults: { title: '', items: '[]' },
    fields: [{ key: 'title', label: 'Title (optional)', kind: 'text' }],
    itemLabel: 'Tile',
    itemFields: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'text', label: 'Text', kind: 'textarea' },
      { key: 'imageUrl', label: 'Image (optional)', kind: 'image' },
      { key: 'url', label: 'Link (optional)', kind: 'url' },
      { key: 'size', label: 'Tile size', kind: 'select', options: [{ value: 'small', label: 'Small' }, { value: 'wide', label: 'Wide' }, { value: 'tall', label: 'Tall' }, { value: 'large', label: 'Large' }] },
    ],
    itemDefaults: { title: 'Feature', text: 'Describe it briefly.', imageUrl: '', url: '', size: 'small' },
  },
  {
    type: 'faq', title: 'FAQ', description: 'Several questions with answers', generic: true,
    defaults: { title: 'Frequently asked questions', items: '[]' },
    fields: [{ key: 'title', label: 'Title', kind: 'text' }],
    itemLabel: 'Question',
    itemFields: [
      { key: 'question', label: 'Question', kind: 'text' },
      { key: 'answer', label: 'Answer', kind: 'textarea' },
    ],
    itemDefaults: { question: 'Frequently asked question', answer: 'Write a helpful answer.' },
  },
  {
    type: 'button', title: 'Button', description: 'A standalone link or call to action', generic: false,
    defaults: { label: 'Learn more', url: '' },
    fields: [],
  },
  {
    type: 'fab', title: 'Floating action button', description: 'A button pinned to the screen corner', generic: true,
    defaults: { label: 'Contact us', icon: '✉', url: '', position: 'bottom-right' },
    fields: [
      { key: 'label', label: 'Label', kind: 'text' },
      { key: 'icon', label: 'Icon (emoji or symbol)', kind: 'text' },
      { key: 'url', label: 'Destination URL', kind: 'url', placeholder: 'https://, mailto: or tel:' },
      { key: 'position', label: 'Position', kind: 'select', options: POSITION },
    ],
  },
];
