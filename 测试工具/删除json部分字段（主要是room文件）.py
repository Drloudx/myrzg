import json
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

class JsonFieldDeleteTool:
    def __init__(self, root):
        self.root = root
        self.root.title("JSON批量字段删除工具")
        # 修复：520x380，去掉逗号空格
        self.root.geometry("520x380")
        self.file_path = tk.StringVar()

        # 1. 文件选择区域
        frame_file = ttk.Frame(root, padding=10)
        frame_file.pack(fill=tk.X)
        ttk.Label(frame_file, text="JSON文件：").pack(side=tk.LEFT)
        ttk.Entry(frame_file, textvariable=self.file_path, width=35).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        ttk.Button(frame_file, text="选择文件", command=self.select_file).pack(side=tk.LEFT)

        # 2. 待删除字段输入区域
        frame_field = ttk.Frame(root, padding=10)
        frame_field.pack(fill=tk.BOTH, expand=True)
        ttk.Label(frame_field, text="待删除字段（一行一个，默认预填entrance、decorates、objects）").pack(anchor=tk.W)
        self.text_fields = tk.Text(frame_field, height=10)
        self.text_fields.pack(fill=tk.BOTH, expand=True, pady=5)
# entrance
# decorates
# objects
# door
# mons
# colliders
# viewRect
# borderRect
# actions
# triggers
# monRounds
# ___classTypeName
# btnIcon
# winLock
# caijiSeedMax
# caijiSeedMin
# caijiHide
# btnText
# showCondition
# stageObjUid
# fxType
# rx
# w
# h
# bgm
# bgmAmbientDay
# bgmAmbientNight
# weatherVolume
# mathScale
        default_text = """

"""
        self.text_fields.insert(tk.END, default_text)

        # 3. 操作按钮区域
        frame_btn = ttk.Frame(root, padding=10)
        frame_btn.pack()
        ttk.Button(frame_btn, text="执行删除并保存", command=self.run_delete).pack()

    def select_file(self):
        path = filedialog.askopenfilename(
            title="选择JSON文件",
            filetypes=[("JSON文件", "*.json"), ("全部文件", "*.*")]
        )
        if path:
            self.file_path.set(path)

    def recursive_remove(self, data, del_keys):
        """递归删除所有层级指定字段"""
        if isinstance(data, dict):
            # 删除当前层级匹配字段
            for key in list(data.keys()):
                if key in del_keys:
                    del data[key]
                else:
                    self.recursive_remove(data[key], del_keys)
        elif isinstance(data, list):
            for item in data:
                self.recursive_remove(item, del_keys)

    def run_delete(self):
        path = self.file_path.get().strip()
        if not path:
            messagebox.showwarning("提示", "请先选择JSON文件！")
            return

        # 读取输入的字段，去空行
        field_text = self.text_fields.get("1.0", tk.END)
        del_keys = [line.strip() for line in field_text.splitlines() if line.strip()]
        if not del_keys:
            messagebox.showwarning("提示", "请填写需要删除的字段名！")
            return

        # 读取JSON
        try:
            with open(path, "r", encoding="utf-8") as f:
                json_data = json.load(f)
        except Exception as e:
            messagebox.showerror("读取失败", f"无法读取JSON：{str(e)}")
            return

        # 执行删除
        self.recursive_remove(json_data, set(del_keys))

        # 覆盖保存
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(json_data, f, ensure_ascii=False, indent=4)
            messagebox.showinfo("完成", f"处理成功！\n已删除字段：{', '.join(del_keys)}")
        except Exception as e:
            messagebox.showerror("保存失败", f"写入文件失败：{str(e)}")

if __name__ == "__main__":
    window = tk.Tk()
    app = JsonFieldDeleteTool(window)
    window.mainloop()