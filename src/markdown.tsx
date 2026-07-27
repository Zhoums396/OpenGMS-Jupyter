import {
  IRenderMime,
  IRenderMimeRegistry,
  RenderMimeRegistry
} from '@jupyterlab/rendermime';
import { Contents } from '@jupyterlab/services';
import React, { useEffect, useMemo, useRef } from 'react';

const MARKDOWN_MIME_TYPE = 'text/markdown';
const STREAM_RENDER_DELAY = 80;

function escapeLatexDelimiters(source: string): string {
  return source
    .replace(/\\\(/g, '\\\\(')
    .replace(/\\\)/g, '\\\\)')
    .replace(/\\\[/g, '\\\\[')
    .replace(/\\\]/g, '\\\\]');
}

function decodePath(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function normalizeRoot(rootDir: string): string {
  const decoded = decodePath(rootDir).replace(/\/+$/, '');
  return decoded === '' ? '/' : decoded;
}

/**
 * Convert an absolute workspace path into the path understood by Jupyter's
 * ContentsManager. Relative URLs and paths outside the workspace are left to
 * the standard JupyterLab resolver.
 */
export function workspaceRelativePath(
  value: string,
  rootDir: string
): string | null {
  if (!rootDir) {
    return null;
  }

  let path = value;
  if (path.startsWith('file://')) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  path = decodePath(path);
  if (!path.startsWith('/') || path.startsWith('//')) {
    return null;
  }

  const root = normalizeRoot(rootDir);
  if (root === '/') {
    return path.slice(1);
  }
  if (!path.startsWith(`${root}/`)) {
    return null;
  }
  return path.slice(root.length + 1);
}

class WorkspaceUrlResolver implements IRenderMime.IResolver {
  constructor(
    private readonly rootDir: string,
    contents: Contents.IManager
  ) {
    this.delegate = new RenderMimeRegistry.UrlResolver({
      path: '__geocopilot__.md',
      contents
    });
  }

  resolveUrl(
    url: string,
    _context?: IRenderMime.IResolveUrlContext
  ): Promise<string> {
    return this.delegate.resolveUrl(this.workspaceUrl(url) ?? url);
  }

  getDownloadUrl(url: string): Promise<string> {
    return this.delegate.getDownloadUrl(url);
  }

  isLocal(url: string, allowRoot = false): boolean {
    const workspaceUrl = this.workspaceUrl(url);
    if (workspaceUrl !== null) {
      return true;
    }
    if (url.startsWith('/') || url.startsWith('file://')) {
      return false;
    }
    return this.delegate.isLocal(url, allowRoot);
  }

  resolvePath(path: string): Promise<IRenderMime.IResolvedLocation | null> {
    const workspaceUrl = this.workspaceUrl(path);
    if (workspaceUrl !== null) {
      return this.delegate.resolvePath(`./${workspaceUrl}`);
    }
    if (path.startsWith('/') || path.startsWith('file://')) {
      return Promise.resolve(null);
    }
    return this.delegate.resolvePath(path);
  }

  private workspaceUrl(url: string): string | null {
    return workspaceRelativePath(url, this.rootDir);
  }

  private readonly delegate: RenderMimeRegistry.UrlResolver;
}

function RendermimeMarkdownBase({
  source,
  complete,
  registry,
  contents,
  workspaceRoot
}: {
  source: string;
  complete: boolean;
  registry: IRenderMimeRegistry;
  contents: Contents.IManager;
  workspaceRoot: string;
}): React.ReactElement {
  const scopedRegistry = useMemo(
    () =>
      registry.clone({
        resolver: new WorkspaceUrlResolver(workspaceRoot, contents)
      }),
    [contents, registry, workspaceRoot]
  );
  const renderer = useMemo(
    () => scopedRegistry.createRenderer(MARKDOWN_MIME_TYPE),
    [scopedRegistry]
  );
  const container = useRef<HTMLDivElement>(null);
  const revision = useRef(0);
  const renderQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const host = container.current;
    if (host && renderer.node.parentElement !== host) {
      host.replaceChildren(renderer.node);
    }
    return () => {
      revision.current += 1;
      renderer.dispose();
    };
  }, [renderer]);

  useEffect(() => {
    const currentRevision = ++revision.current;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        renderQueue.current = renderQueue.current
          .catch(() => undefined)
          .then(async () => {
            if (
              cancelled ||
              renderer.isDisposed ||
              currentRevision !== revision.current
            ) {
              return;
            }
            const model = scopedRegistry.createModel({
              trusted: false,
              data: {
                [MARKDOWN_MIME_TYPE]: escapeLatexDelimiters(source)
              }
            });
            await renderer.renderModel(model);
            if (
              cancelled ||
              renderer.isDisposed ||
              currentRevision !== revision.current
            ) {
              return;
            }
            scopedRegistry.latexTypesetter?.typeset(renderer.node);
          })
          .catch(reason => {
            if (
              !cancelled &&
              !renderer.isDisposed &&
              currentRevision === revision.current
            ) {
              console.error('GeoCopilot could not render Markdown', reason);
              renderer.node.textContent = source;
            }
          });
      },
      complete ? 0 : STREAM_RENDER_DELAY
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [complete, renderer, scopedRegistry, source]);

  return <div className="gc-markdown" ref={container} />;
}

/**
 * Render untrusted Agent text with JupyterLab's native Markdown, sanitizer,
 * code highlighting, workspace-aware link handling, and LaTeX pipeline.
 */
export const RendermimeMarkdown = React.memo(RendermimeMarkdownBase);
