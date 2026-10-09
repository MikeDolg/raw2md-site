export interface PageSpec {
  /** Site path with the trailing slash: `/docs/cleaning/`. */
  route: string;
  /** Page title; when absent, the leading level-1 heading of the source. */
  title?: string;
  /** Description of the page; when absent, the first sentence of the page. */
  summary?: string;
  /** Top-level headings whose sections the page shows; absent means all. */
  keep?: string[];
  /** With `keep`: also show the text before the first heading. */
  intro?: boolean;
}

export interface SourceSpec {
  /** Path inside the public tree, with forward slashes. */
  file: string;
  /** Headings, at any level, whose sections no page shows. */
  drop?: string[];
  pages: PageSpec[];
}

export const manifest: SourceSpec[] = [
  {
    file: 'README.md',
    drop: ['License notes'],
    pages: [
      {
        route: '/',
        title: 'raw2md',
        intro: true,
        keep: [
          'What does raw2md fix?',
          'Why raw2md?',
          "What's the impact?",
          'How does it work?',
          'What languages are supported?',
        ],
      },
      {
        route: '/install/',
        title: 'Install and update',
        summary:
          'Install raw2md with uv or pip on Linux or Windows, with the CUDA build of PyTorch for marker and pandoc for DOCX, then update or uninstall it.',
        keep: ['Installation', 'Update', 'Uninstall'],
      },
      {
        route: '/quickstart/',
        title: 'Get started',
        summary:
          'Convert a file or a folder with raw2md: the service folder, the first commands, the common flags, and the model settings.',
        keep: ['Folders', 'Quick start', 'Options', 'Settings'],
      },
    ],
  },
  { file: 'docs/README.md', pages: [{ route: '/docs/' }] },
  { file: 'docs/reference.md', pages: [{ route: '/docs/reference/' }] },
  { file: 'docs/cleaning.md', pages: [{ route: '/docs/cleaning/' }] },
  { file: 'docs/inspection.md', pages: [{ route: '/docs/inspection/' }] },
  { file: 'docs/post.md', pages: [{ route: '/docs/post/' }] },
  { file: 'docs/quality.md', pages: [{ route: '/docs/quality/' }] },
  {
    file: 'benchmarks/README.md',
    pages: [
      {
        route: '/benchmarks/',
        summary:
          'Scores of the marker output before and after raw2md on the MPDocBench-Parse benchmark, for each element type.',
      },
    ],
  },
  {
    file: 'examples/README.md',
    pages: [
      {
        route: '/examples/',
        summary:
          'Complete raw2md results for a scanned book, a born-digital thesis, and a DOCX report, with the command and the time of each conversion.',
      },
    ],
  },
];
