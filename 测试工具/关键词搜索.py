import os
import sys
import html
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLineEdit, QTextEdit, QFileDialog, QLabel, QMessageBox
)
from PyQt6.QtCore import QThread, pyqtSignal


class SearchWorker(QThread):
    """后台搜索线程，避免界面卡死"""
    result_ready = pyqtSignal(str)       # 发送 HTML 格式的结果
    search_finished = pyqtSignal(int)    # 搜索完成后发送找到的文件总数

    # 支持的文件扩展名元组
    SUPPORTED_EXTS = ('.json', '.cs')

    def __init__(self, folder_path, keyword):
        super().__init__()
        self.folder_path = folder_path
        self.keyword = keyword

    def run(self):
        found_count = 0
        for dirpath, _, filenames in os.walk(self.folder_path):
            for filename in filenames:
                # 【修改点】使用元组同时匹配 .json 和 .cs 后缀（忽略大小写）
                if filename.lower().endswith(self.SUPPORTED_EXTS):
                    file_path = os.path.join(dirpath, filename)
                    try:
                        # 兼容不同编码，优先 utf-8，失败时尝试 gbk/ansi
                        content = None
                        for encoding in ('utf-8', 'gbk', 'utf-8-sig'):
                            try:
                                with open(file_path, 'r', encoding=encoding) as f:
                                    lines = f.readlines()
                                content = (lines, encoding)
                                break
                            except UnicodeDecodeError:
                                continue

                        if content is None:
                            continue

                        lines, _ = content
                        for line_num, line in enumerate(lines, 1):
                            if self.keyword in line:
                                found_count += 1
                                snippet = line.strip()
                                if len(snippet) > 100:
                                    snippet = snippet[:100] + '...'
                                # 转义 HTML 特殊字符，避免解析错误
                                snippet = html.escape(snippet)
                                # 用 HTML 构造结果：文件名加粗，前面带 ✅
                                msg = (
                                    f"<b>✅ {os.path.basename(file_path)}</b><br>"
                                    f"&nbsp;&nbsp;路径: {html.escape(file_path)}<br>"
                                    f"&nbsp;&nbsp;行号: {line_num}<br>"
                                    f"&nbsp;&nbsp;内容: <code>{snippet}</code><br>"
                                    f"<hr>"
                                )
                                self.result_ready.emit(msg)
                                break  # 每个文件只报告一次
                    except Exception as e:
                        error_msg = (
                            f"<b>❌ {os.path.basename(file_path)}</b><br>"
                            f"&nbsp;&nbsp;错误: {html.escape(str(e))}<br>"
                            f"<hr>"
                        )
                        self.result_ready.emit(error_msg)
        self.search_finished.emit(found_count)


class SearchApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("文件关键词搜索工具 (JSON / C#)")
        self.setGeometry(200, 200, 800, 600)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)

        # --- 文件夹选择区域 ---
        folder_layout = QHBoxLayout()
        folder_layout.addWidget(QLabel("目标文件夹:"))
        self.folder_edit = QLineEdit()
        self.folder_edit.setPlaceholderText("选择要搜索的文件夹...")
        self.folder_edit.setText(r"E:\Desktop\羊2\Config_decrypted")
        folder_layout.addWidget(self.folder_edit)
        btn_browse = QPushButton("浏览...")
        btn_browse.clicked.connect(self.browse_folder)
        folder_layout.addWidget(btn_browse)
        layout.addLayout(folder_layout)

        # --- 关键词输入区域 ---
        keyword_layout = QHBoxLayout()
        keyword_layout.addWidget(QLabel("关键词:"))
        self.keyword_edit = QLineEdit()
        self.keyword_edit.setPlaceholderText("例如 item_54003 或 PlayerController")
        keyword_layout.addWidget(self.keyword_edit)
        self.btn_search = QPushButton("开始搜索")
        self.btn_search.clicked.connect(self.start_search)
        keyword_layout.addWidget(self.btn_search)
        layout.addLayout(keyword_layout)

        # --- 结果显示区域（支持 HTML 渲染）---
        self.result_display = QTextEdit()
        self.result_display.setReadOnly(True)
        self.result_display.setAcceptRichText(True)
        layout.addWidget(self.result_display)

        self.statusBar().showMessage("就绪")
        self.worker = None

    def browse_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "选择文件夹")
        if folder:
            self.folder_edit.setText(folder)

    def start_search(self):
        folder = self.folder_edit.text().strip()
        keyword = self.keyword_edit.text().strip()

        if not folder:
            QMessageBox.warning(self, "提示", "请先选择目标文件夹。")
            return
        if not keyword:
            QMessageBox.warning(self, "提示", "请输入关键词。")
            return

        self.btn_search.setEnabled(False)
        self.statusBar().showMessage("搜索中，请稍候...")
        self.result_display.clear()
        self.result_display.append(f"📂 搜索目录: {folder}")
        self.result_display.append(f"🔍 关键词: {keyword}")
        self.result_display.append("📑 包含类型: .json, .cs\n")

        self.worker = SearchWorker(folder, keyword)
        self.worker.result_ready.connect(self.display_result)
        self.worker.search_finished.connect(self.on_search_finished)
        self.worker.start()

    def display_result(self, html_text):
        self.result_display.append(html_text)

    def on_search_finished(self, found_count):
        self.result_display.append("<br>搜索结束！")
        if found_count > 0:
            self.result_display.append(f"🎉 共在 {found_count} 个文件中找到关键词。")
        else:
            self.result_display.append("未找到包含该关键词的文件。")
        self.btn_search.setEnabled(True)
        self.statusBar().showMessage(f"搜索完成，共命中 {found_count} 个文件")


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = SearchApp()
    window.show()
    sys.exit(app.exec())