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
  /**
   * Headings, at any level, whose sections the site shows as parts. The page
   * lists the parts and links the whole source on GitHub; each part gets its
   * own page outside the search index.
   */
  excerpts?: string[];
  /** Markdown line over the page and its parts: the source and the license. */
  notice?: string;
}

export interface SourceSpec {
  /** Path inside the public tree, with forward slashes. */
  file: string;
  /** Headings, at any level, whose sections no page shows. */
  drop?: string[];
  pages: PageSpec[];
}

const MARKER_LICENSE =
  'The text is output of the `marker` models by Datalab, cleaned by raw2md, and the modified AI Pubs OpenRAIL-M license of the models applies to it: [MODEL_LICENSE](MODEL_LICENSE).';

export const manifest: SourceSpec[] = [
  {
    file: 'README.md',
    drop: ['License notes'],
    pages: [
      {
        route: '/',
        title: 'raw2md',
        summary:
          'raw2md is an open-source command-line tool that converts PDF, DjVu, and DOCX documents into clean Markdown for RAG and LLM pipelines.',
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
  {
    file: 'examples/book.md',
    pages: [
      {
        route: '/examples/book/',
        title: 'Elementary Mechanism',
        summary:
          'The raw2md result for a scanned textbook of 1885, Elementary Mechanism by Woods and Stahl: three chapters.',
        notice: `Source: Arthur T. Woods, Albert W. Stahl. *Elementary Mechanism: A Textbook for Students of Mechanical Engineering*. D. Van Nostrand, New York, 1885. [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Elementary_mechanism-_a_textbook_for_students_of_mechanical_engineering_(IA_cu31924031203742).pdf), Public Domain Mark. ${MARKER_LICENSE}`,
        excerpts: ['CHAPTER I.', 'CHAPTER X.', 'CHAPTER XII.'],
      },
    ],
  },
  {
    file: 'examples/thesis.md',
    pages: [
      {
        route: '/examples/thesis/',
        title: 'Deep Circular Excavation',
        summary:
          'The raw2md result for a born-digital PhD thesis of 2014 on the monitoring and modelling of a deep circular excavation: three chapters.',
        notice: `Source: Tina Schwamb. *Performance Monitoring and Numerical Modelling of a Deep Circular Excavation*. PhD thesis, University of Cambridge, 2014. [University of Cambridge repository](https://www.repository.cam.ac.uk/items/04ec45a9-4b8b-4ece-b848-7806d4636412), CC0 1.0. ${MARKER_LICENSE}`,
        excerpts: ['Chapter 1', 'Chapter 2', 'Chapter 6'],
      },
    ],
  },
];
