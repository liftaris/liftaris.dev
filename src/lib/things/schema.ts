import type { CreateFieldInput, CreateCollectionInput } from 'emdash';
const num = (slug: string, label: string, value: number, min: number, max: number, step?: number): CreateFieldInput => ({ slug, label, type: ['width','height','sort_order'].includes(slug) ? 'integer' : 'number', defaultValue: value, validation: { min, max, ...(step ? { step } : {}) } });
const select = (slug: string, label: string, options: string[], value: string): CreateFieldInput => ({ slug, label, type: 'select', defaultValue: value, validation: { options } });
export const thingFields: CreateFieldInput[] = [
  { slug: 'name', label: 'Name', type: 'string', required: true, searchable: true },
  select('kind', 'Kind', ['page', 'folder', 'application'], 'folder'),
  select('icon_type', 'Icon type', ['emoji', 'image'], 'emoji'),
  { slug: 'emoji', label: 'Emoji', type: 'string', defaultValue: '📦' },
  { slug: 'image', label: 'Icon image', type: 'image' },
  num('width', 'Icon width', 60, 24, 240), num('height', 'Icon height', 60, 24, 240),
  num('window_width', 'Initial window width', 480, 180, 2560), num('window_height', 'Initial window height', 380, 100, 1800),
  { slug: 'window_x', label: 'Initial window X (0–1)', type: 'number', validation: { min: 0, max: 1 } },
  { slug: 'window_y', label: 'Initial window Y (0–1)', type: 'number', validation: { min: 0, max: 1 } },
  { slug: 'desktop', label: 'Show on homepage', type: 'boolean', defaultValue: true },
  { slug: 'default_open', label: 'Open on arrival', type: 'boolean', defaultValue: false },
  num('sort_order', 'Homepage order', 0, 0, 100000), num('spawn_x', 'Starting X', .5, 0, 1, 0.001), num('spawn_y', 'Starting Y', .5, 0, 1, 0.001),
  { slug: 'contents', label: 'Folder contents', type: 'reference', validation: { targetCollection: 'things', multiple: true } },
  { slug: 'primary_folder', label: 'Primary folder (URL)', type: 'reference', validation: { targetCollection: 'things', multiple: false } },
  { slug: 'path_override', label: 'Custom site path', type: 'string' },
  select('page_source', 'Page source', ['content', 'post', 'projects', 'experience', 'github', 'clump'], 'content'),
  { slug: 'post', label: 'Post', type: 'reference', validation: { targetCollection: 'posts', multiple: false } },
  select('application', 'Application', ['leave-gift'], 'leave-gift'),
  { slug: 'body', label: 'Content', type: 'portableText', searchable: true },
  { slug: 'date', label: 'Article date', type: 'datetime' },
  { slug: 'background_image', label: 'Folder background', type: 'image' },
  select('background_size', 'Background fit', ['cover', 'contain', 'auto', '100% 100%', '50%', '75%', '150%', '200%'], 'cover'),
  select('background_position', 'Background position', ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'], 'center'),
  select('background_repeat', 'Background repeat', ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'round', 'space'], 'no-repeat'),
  { slug: 'legacy_paths', label: 'Former paths', type: 'json', defaultValue: [] },
];
export const thingsCollection = { slug: 'things', label: 'Things', labelSingular: 'Thing', icon: 'shapes', supports: ['preview', 'search', 'seo'], editLocking: true, routable: true, urlPattern: '/things-preview/{id}', commentsEnabled: true, admin: { listColumns: ['name', 'kind', 'desktop'] } } satisfies CreateCollectionInput;
