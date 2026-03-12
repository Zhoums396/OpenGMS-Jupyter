"""
Custom Jupyter Server Configuration
允许在文件浏览器中递归删除非空目录
"""
import os
import shutil
from tornado import web
from jupyter_server.services.contents.largefilemanager import LargeFileManager


class RecursiveDeleteContentsManager(LargeFileManager):
    """
    扩展 LargeFileManager，允许递归删除非空目录。
    默认的 FileContentsManager 会拒绝删除非空目录，
    这对用户来说非常不方便。
    """

    def delete_file(self, path):
        """Delete file or directory, supporting non-empty directories."""
        path = path.strip("/")
        os_path = self._get_os_path(path)

        if not os.path.exists(os_path):
            raise web.HTTPError(404, "File or directory does not exist: %s" % path)

        if os.path.isdir(os_path):
            self.log.info("Recursively deleting directory: %s", os_path)
            shutil.rmtree(os_path)
        else:
            self.log.info("Deleting file: %s", os_path)
            os.unlink(os_path)


# === 核心网络配置（必须保留，否则容器外部无法访问） ===
c.ServerApp.ip = '0.0.0.0'
c.ServerApp.open_browser = False
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_remote_access = True

# === 自定义 ContentsManager ===
c.ServerApp.contents_manager_class = RecursiveDeleteContentsManager
