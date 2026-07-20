export const repoUrl = 'https://github.com/Zhoums396/GeoCopilot'
export const withBase = path => `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`
export const siteHomeUrl = withBase('')
export const docsPageUrl = withBase('docs/')
export const quickStartUrl = `${repoUrl}#readme`
export const geomodelDocsUrl = `${repoUrl}/tree/main/jupyterlab-geomodel`
export const agentDocsUrl = `${repoUrl}/tree/main/jupyterlab-ai-agent`
export const skillsDocsUrl = `${repoUrl}/tree/main/agent-service/agent_service/skills`
export const faviconUrl = withBase('opengeolab-favicon.ico')

export const navPages = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/features' },
  { label: 'Download', to: '/download' },
  { label: 'Video', to: '/video' }
]

export const heroTags = [
  'Workspace-aware context',
  'Insert and re-run cells',
  'File and terminal tools',
  'Smart cases + history'
]

export const spotlightItems = [
  {
    key: 'context',
    index: 'IN [1]',
    title: 'Read workspace context',
    description: 'Uses the current notebook, active cell, working directory, project info, and workspace files.'
  },
  {
    key: 'cells',
    index: 'IN [2]',
    title: 'Insert, edit, and run notebook cells',
    description: 'Front-end actions add code cells, revise existing code, and write markdown explanations.'
  },
  {
    key: 'repair',
    index: 'IN [3]',
    title: 'Diagnose failures and recover in place',
    description: 'Captures cell output, diagnoses errors, and steers the next edit instead of starting over.'
  },
  {
    key: 'workflow',
    index: 'IN [4]',
    title: 'Guide multi-step workspace workflows',
    description: 'Supports agent mode, ask mode, smart cases, history, project files, and terminal tasks.'
  }
]

export const spotlightData = {
  context: {
    videoSrc: withBase('doc1.mp4'),
    caption: 'CTX [1]',
    badge: 'Workspace context',
    label: 'What the agent reads',
    main:
      'Current notebook, active cell code, working directory,\nproject name, workspace files, and recent outputs.',
    sideTitle: 'ChatContext from workspace state',
    sideAction: 'Plan the next step before writing code',
    outputTag: 'Grounded',
    outputTitle: 'Workspace-aware reasoning',
    outputCopy:
      'The sidebar is not a floating chatbot. It builds replies from live workspace state and project context before deciding whether to answer directly or use tools.',
    points: [
      'Current notebook + active cell',
      'Workspace files + project info',
      'Recent output and error state'
    ]
  },
  cells: {
    videoSrc: withBase('doc2.mp4'),
    caption: 'ACT [2]',
    badge: 'Frontend action',
    label: 'Direct notebook actions',
    main:
      'add_code_cell(code, run=true)\nedit_code_cell(cell_index, code)\nadd_markdown_cell(content)',
    sideTitle: 'Actions implemented in the panel',
    sideAction: 'Insert below, re-run, or explain in markdown',
    outputTag: 'Execution',
    outputTitle: 'Operate on the notebook, not just talk about it',
    outputCopy:
      'The agent can add code cells, revise existing cells in place, and write markdown explanations directly inside JupyterLab.',
    points: ['Insert and run code', 'Edit and re-run failed cells', 'Add markdown explanations']
  },
  repair: {
    videoSrc: withBase('doc3.mp4'),
    caption: 'DBG [3]',
    badge: 'Diagnostic loop',
    label: 'Error-aware tool chain',
    main:
      'diagnose_error | suggest_imports | explain_code\nCapture stdout, results, plots, and traceback after execution.',
    sideTitle: 'Cell output is fed back into the loop',
    sideAction: 'Fix the failing cell instead of restarting',
    outputTag: 'Recovery',
    outputTitle: 'Execution feedback changes the next step',
    outputCopy:
      'When a generated cell fails, the agent can inspect the returned output, keep the cell index, and issue a targeted edit-and-rerun step.',
    points: ['Error diagnosis', 'Import suggestions', 'Output-aware repair']
  },
  workflow: {
    videoSrc: withBase('doc4.mp4'),
    caption: 'OPS [4]',
    badge: 'Workflow control',
    label: 'Beyond one-off answers',
    main:
      'Modes: agent or ask\nExtras: smart cases, chat history, model settings,\nproject file inspection, terminal commands',
    sideTitle: 'Conversation + project operations',
    sideAction: 'Reproduce a workflow or continue later',
    outputTag: 'Operator',
    outputTitle: 'Built for step-by-step notebook work',
    outputCopy:
      'The sidebar combines reusable starter prompts, history, project inspection, and terminal actions so the agent can carry a workflow instead of stopping at a single response.',
    points: ['Agent and ask modes', 'Smart case starters', 'History, files, and terminal access']
  }
}

export const capabilityCards = [
  {
    number: '01',
    tone: 'capability-blue',
    title: 'Chat inside JupyterLab with workspace-aware context',
    body:
      'The sidebar reads notebook name, current cell code, project identity, and workspace files before deciding how to respond.'
  },
  {
    number: '02',
    tone: 'capability-sand',
    title: 'Insert code and markdown directly into cells',
    body:
      'Front-end actions are wired to add code cells, add markdown cells, and re-run the notebook without forcing the user to copy and paste by hand.'
  },
  {
    number: '03',
    tone: 'capability-mint',
    title: 'Inspect files and run terminal commands when needed',
    body:
      'The agent can operate beyond chat by searching files, reading project state, and using terminal steps to keep longer workflows moving.'
  },
  {
    number: '04',
    tone: 'capability-lilac',
    title: 'Close the loop with diagnostics, history, and reusable cases',
    body:
      'It captures execution feedback, keeps conversation history, and supports reusable smart cases so users can resume structured notebook work instead of restarting from a blank chat.',
    points: ['Diagnose errors', 'Suggest imports', 'Chat history', 'Smart cases']
  }
]

export const homeCapabilityPanels = [
  {
    tone: 'capability-blue',
    size: 'wide',
    icon: 'AI',
    title: 'AI-powered workspace assistant for GeoCopilot',
    body:
      'The sidebar helps users stay inside JupyterLab while it reads workspace context, writes executable cells, runs code, and explains the next step from real workspace state.'
  },
  {
    tone: 'capability-sand',
    size: 'tall',
    icon: 'CTX',
    title: 'Continuous context awareness',
    body:
      'The agent uses the active notebook, current cell, workspace files, and recent execution output to decide what to do next.'
  },
  {
    tone: 'capability-mint',
    size: 'tall',
    icon: 'LAB',
    title: 'Stay in Jupyter, keep the workflow moving',
    body:
      'Users do not need to bounce between a notebook and a separate tool. The agent can insert cells, revise code, and keep work moving in place.'
  },
  {
    tone: 'capability-lilac',
    size: 'wide',
    icon: 'OPS',
    title: 'Core capabilities',
    subtitle: 'Everything the agent needs to support workspace work',
    points: [
      'Context-aware suggestions from workspace state',
      'Direct code-cell and markdown-cell actions',
      'Execution feedback, debugging, and fix-forward recovery',
      'History, smart cases, files, and terminal support'
    ]
  }
]

export const workflowSteps = [
  {
    number: '01',
    title: 'Configure the agent and open a notebook',
    body:
      'Set the LLM provider once, then work inside JupyterLab with either ask mode for direct answers or agent mode for tool-driven execution.'
  },
  {
    number: '02',
    title: 'Describe the task or start from a smart case',
    body:
      'Before acting, the agent reads notebook name, current cell code, working directory, project info, and available workspace files.'
  },
  {
    number: '03',
    title: 'Let the tool loop write, run, and repair',
    body:
      'The agent can insert code, add markdown, inspect files, run terminal commands, capture cell output, and patch the next step from execution feedback.'
  }
]

export const caseCards = [
  {
    eyebrow: 'Workspace repair',
    title: 'Fix a failing analysis cell without leaving the workspace',
    body:
      'The agent can read the traceback, keep the failing cell index, and issue an edit-and-rerun step instead of asking the user to patch everything manually.'
  },
  {
    eyebrow: 'Guided coding',
    title: 'Generate the next code or markdown cell from live context',
    body:
      'Because the sidebar sees workspace state and surrounding project information, it can propose the next executable step instead of generic sample code.'
  },
  {
    eyebrow: 'Workflow reproduction',
    title: 'Inspect files and terminal state to continue a project',
    body:
      'For longer workflows, the agent can inspect project files, search the workspace, run terminal commands, and continue from previous chat history.'
  }
]

export const downloadCards = [
  {
    eyebrow: 'Install',
    title: 'Install the JupyterLab extension from source',
    body:
      'Use the repository install guide for `jupyterlab-geomodel` and register the labextension in your local JupyterLab environment.',
    meta: 'Targets /jupyterlab-geomodel',
    actionLabel: 'Open install guide',
    href: geomodelDocsUrl
  },
  {
    eyebrow: 'Repository',
    title: 'Browse the full GeoCopilot repository',
    body:
      'Jump straight to the open-source repo if you want the code, issue tracker, and the complete relationship between GeoModelWeb, agent-service, and the extension.',
    meta: 'GitHub source of truth',
    actionLabel: 'Open GitHub repo',
    href: repoUrl
  },
  {
    eyebrow: 'Agent',
    title: 'Read the standalone AI agent sidebar docs',
    body:
      'The AI agent has its own JupyterLab extension and README. It is presented separately from the companion GeoModel plugin features.',
    meta: 'Targets /jupyterlab-ai-agent',
    actionLabel: 'Open agent docs',
    href: agentDocsUrl
  }
]

export const projectCards = [
  {
    eyebrow: 'Web App',
    title: 'GeoModelWeb',
    body:
      'The repository root describes this as the web application layer with separate client and server folders.',
    actionLabel: 'Open repo root',
    href: repoUrl
  },
  {
    eyebrow: 'Agent Service',
    title: 'agent-service',
    body:
      'This Python service carries the executable skills, routing logic, and back-end agent orchestration.',
    actionLabel: 'Open skills docs',
    href: skillsDocsUrl
  },
  {
    eyebrow: 'Jupyter Extension',
    title: 'jupyterlab-geomodel',
    body:
      'This is the JupyterLab extension installation target shown on this page, and the place where OpenGeoLab notebook integration lives.',
    actionLabel: 'Open extension docs',
    href: geomodelDocsUrl
  },
  {
    eyebrow: 'AI Sidebar',
    title: 'jupyterlab-ai-agent',
    body:
      'This independent sidebar extension is the clearest documentation source for the AI agent itself.',
    actionLabel: 'Open agent README',
    href: agentDocsUrl
  }
]

export const installCommand = `cd jupyterlab-geomodel
pip install -e .
jupyter labextension develop . --overwrite`

export const videoHighlights = [
  {
    eyebrow: 'Context',
    title: 'Watch how the sidebar stays inside the workspace',
    body:
      'The demo should reinforce that this is a Jupyter-native agent workflow rather than a separate portal screen.'
  },
  {
    eyebrow: 'Execution',
    title: 'Look for cell-writing and feedback loops',
    body:
      'The product is strongest when the video shows code insertion, execution, and the next correction step instead of a passive chat demo.'
  },
  {
    eyebrow: 'Recovery',
    title: 'Watch how the agent reacts to errors and intermediate output',
    body:
      'A strong demo shows the next step changing after stdout, traceback, or chart output comes back from the workspace.'
  },
  {
    eyebrow: 'Outcome',
    title: 'End on a visible workspace result',
    body:
      'Finish with a chart, table, map, or repaired cell so the viewer sees a real workspace outcome instead of only chat text.'
  }
]
