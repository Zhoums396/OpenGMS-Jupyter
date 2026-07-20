import { agentDocsUrl, docsPageUrl, geomodelDocsUrl, quickStartUrl, repoUrl, skillsDocsUrl, withBase } from './site'

export const fullStartupCommand = `cd GeoModelWeb/server
npm install
npm start

cd ../client
npm install
npm run dev

cd ../../agent-service
pip install -e .
python run.py`

export const extensionDevCommand = `cd jupyterlab-geomodel
jlpm install
jlpm watch

# in another terminal
jupyter lab --watch`

export const envCommand = `OPENAI_API_KEY=your_key_here
OGMS_API_URL=https://your-opengms-endpoint`

export const docsPages = [
  {
    slug: '',
    navTitle: 'About GeoCopilot',
    title: 'About GeoCopilot',
    description:
      'What the product includes, how the repository is organized, and why the AI sidebar should be separated from companion extension capabilities.',
    intro:
      'GeoCopilot is a JupyterLab-centered geospatial modeling platform that combines web services, notebook integration, and an AI agent workflow.',
    paragraphs: [
      'GeoCopilot combines a workspace-facing extension, an AI sidebar, and a supporting agent service into one Jupyter-centered workflow.',
      'The project scope matters because the AI sidebar, the GeoModel companion extension, the web application, and the back-end agent service are related but not identical pieces.'
    ],
    bullets: [
      'GeoModelWeb covers the client and server web application.',
      'agent-service provides Python-side agent execution and routing.',
      'jupyterlab-geomodel provides the OpenGeoLab extension inside JupyterLab.',
      'jupyterlab-ai-agent documents the standalone AI sidebar behavior.'
    ],
    references: [
      { label: 'Repository root README', href: quickStartUrl },
      { label: 'GeoModel extension docs', href: geomodelDocsUrl },
      { label: 'AI sidebar README', href: agentDocsUrl }
    ],
    sections: [
      {
        id: 'runcell-ai',
        title: 'GeoCopilot',
        paragraphs: [
          'GeoCopilot is easiest to understand when the AI agent and the companion extension are described as cooperating layers instead of one blurred feature list.',
          'That boundary matters because model browsing, data-method browsing, and parameter-to-code are real product capabilities, but they are not the same thing as the agent tool loop.'
        ]
      },
      {
        id: 'features',
        title: 'What Is Included',
        bullets: [
          'Web application: Vue front end and Node.js server.',
          'Agent service: Python back end for skill execution and orchestration.',
          'Jupyter extension: notebook-facing OpenGeoLab integration.',
          'Standalone AI sidebar: focused agent interaction for JupyterLab.'
        ]
      }
    ]
  },
  {
    slug: 'setup-and-installation',
    navTitle: 'Setup Guide',
    title: 'Setup and Installation',
    description:
      'How to install the extension, start the supporting services, and run the Jupyter workflow locally.',
    intro:
      'The repository README and extension README define the quick-start order. This page pulls those steps into one place so users can understand what needs to run.',
    references: [
      { label: 'Quick start in repo README', href: quickStartUrl },
      { label: 'Extension install README', href: geomodelDocsUrl }
    ],
    sections: [
      {
        id: 'requirements',
        title: 'Requirements',
        bullets: [
          'JupyterLab 4.0.0 or higher for the extension flow.',
          'A Python environment for the agent service and extension.',
          'Node.js and npm for the web client and server.',
          'Configured environment variables for OpenAI access and OpenGMS API access when deployment needs them.'
        ]
      },
      {
        id: 'quick-installation',
        title: 'Quick Installation',
        paragraphs: [
          'The fastest documented path for the notebook extension is the source install flow below.'
        ],
        code: `cd jupyterlab-geomodel
pip install -e .
jupyter labextension develop . --overwrite`
      },
      {
        id: 'checking-your-environment',
        title: 'Start Supporting Services',
        paragraphs: [
          'If you are running the broader project locally, the root README also describes the startup order for the server, client, and agent service.'
        ],
        code: fullStartupCommand
      },
      {
        id: 'installation-methods',
        title: 'Extension Development Mode',
        paragraphs: [
          'For active extension work, the GeoModel README documents a watch mode for the TypeScript source and a watched JupyterLab session.'
        ],
        code: extensionDevCommand
      }
    ]
  },
  {
    slug: 'ai-agent-sidebar',
    navTitle: 'AI Agent Sidebar',
    title: 'AI Agent Sidebar',
    description:
      'Core agent behavior, workspace-aware actions, diagnostics, and why the feature page can claim direct workspace operations.',
    intro:
      'The dedicated AI sidebar extension is intentionally documented as independent from the existing GeoModel extension, even though the overall product experience can bring them together.',
    references: [
      { label: 'Standalone AI sidebar README', href: agentDocsUrl },
      { label: 'Skills architecture docs', href: skillsDocsUrl }
    ],
    sections: [
      {
        id: 'core-agent-capabilities',
        title: 'Core Agent Capabilities',
        bullets: [
          'Left sidebar chat panel inside JupyterLab.',
          'Workspace-aware context that includes current cell code and working directory.',
          'Ask mode for direct responses and agent mode for tool-driven execution.',
          'Chat history, smart cases, and model settings in the panel.'
        ]
      },
      {
        id: 'notebook-actions',
        title: 'Notebook Actions Exposed To The Front End',
        paragraphs: [
          'The current implementation supports workspace-aware actions rather than passive chat only. That is why the feature page can legitimately claim code insertion and cell editing.'
        ],
        bullets: [
          'Add a code cell and execute it.',
          'Edit an existing code cell and re-run it in place.',
          'Insert a markdown cell for explanations or workflow notes.',
          'Capture execution output and use it to steer the next step.'
        ]
      },
      {
        id: 'diagnostics-recovery-loop',
        title: 'Diagnostics And Recovery Loop',
        paragraphs: [
          'The agent flow is strongest when it uses actual execution feedback. That means stdout, result output, chart output, warnings, and tracebacks can affect the next action.'
        ],
        bullets: [
          'Diagnose errors instead of only restating them.',
          'Suggest missing imports and fix-forward steps.',
          'Keep the edited cell index so a retry can happen in place.'
        ]
      }
    ]
  },
  {
    slug: 'companion-extension',
    navTitle: 'OpenGeoLab Companion Extension',
    title: 'OpenGeoLab Companion Extension',
    description:
      'Model browser, data methods, favorites, parameter forms, and code generation that surround the agent workflow.',
    intro:
      'This section documents the GeoModel extension capabilities that surround the agent. These features are real, but they should be kept conceptually separate from the agent feature list.',
    references: [
      { label: 'GeoModel extension README', href: geomodelDocsUrl }
    ],
    sections: [
      {
        id: 'browser-features',
        title: 'Model, Data Method, And Favorites Browsers',
        bullets: [
          'Browse and search the OpenGMS model library.',
          'Browse and search data methods.',
          'Review personal favorites inside the extension.'
        ]
      },
      {
        id: 'parameter-code-generation',
        title: 'Parameter Forms And Code Generation',
        paragraphs: [
          'The companion extension includes the visual parameter form and code generation flow. Those are OpenGeoLab notebook tools, not agent-native reasoning tools.'
        ],
        bullets: [
          'Fill parameters in a structured form.',
          'Generate Python calling code automatically.',
          'Insert generated code into the active notebook cell.'
        ]
      },
      {
        id: 'documented-usage-flow',
        title: 'Documented Usage Flow',
        bullets: [
          'Start JupyterLab.',
          'Open the GeoModel panel from the right sidebar.',
          'Choose Model or Data Method.',
          'Fill or upload parameters.',
          'Preview generated code and insert it into the notebook.'
        ]
      }
    ]
  },
  {
    slug: 'skills-and-execution-model',
    navTitle: 'Skills and Execution Model',
    title: 'Skills and Execution Model',
    description:
      'Why the skills layer is executable logic, how the categories are organized, and what actions can be sent back to the front end.',
    intro:
      'The agent-service documentation makes it clear that the skills layer is executable logic, not just metadata. That is the strongest technical basis for the AI product narrative.',
    references: [
      { label: 'Skills architecture source', href: skillsDocsUrl }
    ],
    sections: [
      {
        id: 'implemented-skill-categories',
        title: 'Implemented Skill Categories',
        bullets: [
          'Notebook skills such as insert_code, insert_markdown, execute_cell, and clear_output.',
          'Model skills such as search_models, get_model_info, invoke_model, and task tracking.',
          'Diagnostic skills such as diagnose_error, suggest_imports, and explain_code.',
          'Data skills such as list_files, read_data, preview_data, and save_data.'
        ]
      },
      {
        id: 'front-end-action-contract',
        title: 'Front-End Action Contract',
        paragraphs: [
          'Skills can return front-end actions that the interface executes. This is why the agent can move from analysis into direct notebook modification.'
        ],
        bullets: [
          'Add code cell with optional auto-run.',
          'Add markdown cell above or below.',
          'Run the current cell.',
          'Clear output when the workflow needs a reset.'
        ]
      },
      {
        id: 'why-this-matters-for-the-product-page',
        title: 'Why This Matters For The Product Page',
        paragraphs: [
          'The skills architecture is the reason the product can talk about execution, recovery, and workspace operations with confidence instead of drifting into generic AI copy.'
        ]
      }
    ]
  },
  {
    slug: 'project-architecture',
    navTitle: 'Project Architecture',
    title: 'Project Architecture',
    description:
      'Repository boundaries, technology stack, and environment configuration for the broader platform.',
    intro:
      'The repository is intentionally split across web, agent, and extension layers. The docs should help users understand those boundaries instead of flattening everything into one vague product story.',
    sections: [
      {
        id: 'repository-structure',
        title: 'Repository Structure',
        bullets: [
          'GeoModelWeb/client: Vue 3 and Vite front end.',
          'GeoModelWeb/server: Node.js and Express back end.',
          'agent-service: Python agent service.',
          'jupyterlab-geomodel: TypeScript and React-based JupyterLab extension.'
        ]
      },
      {
        id: 'technology-stack',
        title: 'Technology Stack',
        bullets: [
          'Front end: Vue.js 3, Vite, Element Plus.',
          'Back end: Node.js, Express.',
          'Agent service: Python, LangChain, FastAPI.',
          'Jupyter extension: TypeScript and React.'
        ]
      },
      {
        id: 'environment-configuration',
        title: 'Environment Configuration',
        paragraphs: [
          'The root README describes copying `.env.example` to `.env` and configuring the key environment variables below.'
        ],
        code: envCommand
      }
    ]
  },
  {
    slug: 'faq-and-notes',
    navTitle: 'FAQ and Notes',
    title: 'FAQ and Notes',
    description:
      'Clarifications that matter when turning the repository into a polished product and docs experience.',
    intro:
      'These clarifications help users understand which behaviors belong to the AI agent, which belong to the companion extension, and how to get started quickly.',
    sections: [
      {
        id: 'is-everything-an-agent-feature',
        title: 'Is everything on the site an AI agent feature?',
        paragraphs: [
          'No. The AI sidebar has its own workspace-aware, tool-driven behavior. The OpenGeoLab extension adds companion features such as model browsing and parameter-to-code generation.'
        ]
      },
      {
        id: 'where-do-these-docs-come-from',
        title: 'Where do these docs come from?',
        paragraphs: [
          'The documentation is assembled from the repository README, the standalone AI sidebar README, the GeoModel extension README, and the agent-service skills documentation.'
        ]
      },
      {
        id: 'what-should-a-new-user-do-first',
        title: 'What should a new user do first?',
        bullets: [
          'Read the setup guide in these docs.',
          'Open the Download page for the installation path.',
          'Review Features to understand agent-native behavior.',
          'Watch the Video page to see the workspace workflow in motion.'
        ]
      }
    ]
  }
]

export const getDocsPageHref = slug => (slug ? withBase(`docs/${slug}/`) : docsPageUrl)
