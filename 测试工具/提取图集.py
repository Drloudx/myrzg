import os
import shutil
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

"""
功能：递归遍历选中根文件夹，把所有 Atlas图集对 (.png + .json) 提取到输出目录
规则：
1. 匹配：同名的 xxx_Atlas.png + xxx_Atlas.json 成对文件
2. 输出目录：E:/Desktop/html/myrzg/UI_Atlases（可修改）
3. GUI：可以浏览选择扫描根目录，可改输出文件夹，可选复制PNG/JSON/全部
4. 复制文件，不移动原文件，避免误删
"""

class AtlasExtractGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("提取所有Atlas图集文件")
        self.root.geometry("720x320")

        self.var_scan_root = tk.StringVar()
        self.var_out_dir = tk.StringVar(value=r"E:\Desktop\html\myrzg\UI_Atlases")
        # 复制模式: all / png_only / json_only
        self.var_mode = tk.StringVar(value="all")

        main = ttk.Frame(root, padding=12)
        main.pack(fill=tk.BOTH, expand=True)

        # 扫描根目录
        ttk.Label(main, text="扫描根文件夹:").grid(row=0, column=0, sticky="w")
        ttk.Entry(main, textvariable=self.var_scan_root, width=55).grid(row=0, column=1, padx=6)
        ttk.Button(main, text="选择", command=self.select_scan_dir).grid(row=0, column=2)

        # 输出目录
        ttk.Label(main, text="输出存放文件夹:").grid(row=1, column=0, sticky="w", pady=(10,0))
        ttk.Entry(main, textvariable=self.var_out_dir, width=55).grid(row=1, column=1, padx=6)
        ttk.Button(main, text="选择", command=self.select_out_dir).grid(row=1, column=2)

        # 选择复制类型单选框
        mode_frame = ttk.LabelFrame(main, text="复制选项")
        mode_frame.grid(row=2, column=0, columnspan=3, sticky="ew", pady=(10,0))
        ttk.Radiobutton(mode_frame, text="PNG+JSON 两者都复制", variable=self.var_mode, value="all").pack(side=tk.LEFT, padx=8)
        ttk.Radiobutton(mode_frame, text="仅复制PNG图集", variable=self.var_mode, value="png_only").pack(side=tk.LEFT, padx=8)
        ttk.Radiobutton(mode_frame, text="仅复制JSON描述", variable=self.var_mode, value="json_only").pack(side=tk.LEFT, padx=8)

        # 按钮
        btn_frame = ttk.Frame(main)
        btn_frame.grid(row=3, column=0, columnspan=3, pady=12)
        ttk.Button(btn_frame, text="开始提取复制", command=self.run_extract).pack()

        #日志
        ttk.Label(main, text="日志：").grid(row=4, column=0, sticky="w")
        self.log_text = tk.Text(main, height=8)
        self.log_text.grid(row=5, column=0, columnspan=3, sticky="nsew")

        main.rowconfigure(5, weight=1)
        main.columnconfigure(1, weight=1)

    def log(self, msg):
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.root.update_idletasks()

    def select_scan_dir(self):
        d = filedialog.askdirectory(title="选择要扫描的根目录")
        if d:
            self.var_scan_root.set(d)

    def select_out_dir(self):
        d = filedialog.askdirectory(title="选择输出存放文件夹")
        if d:
            self.var_out_dir.set(d)

    def run_extract(self):
        scan_root = self.var_scan_root.get()
        out_dir = self.var_out_dir.get()
        mode = self.var_mode.get()

        if not os.path.isdir(scan_root):
            messagebox.showerror("错误", "请先选择扫描根文件夹")
            return
        os.makedirs(out_dir, exist_ok=True)

        self.log(f"开始扫描目录：{scan_root}")
        self.log(f"输出目录：{out_dir}")
        mode_text = {"all":"PNG+JSON全部","png_only":"仅PNG","json_only":"仅JSON"}[mode]
        self.log(f"复制模式：{mode_text}\n")

        copied_group = 0
        copied_png = 0
        copied_json = 0

        # 递归遍历所有子文件夹
        for dirpath, _, filenames in os.walk(scan_root):
            png_candidates = {}
            for fn in filenames:
                #匹配 xxx_Atlas.png
                if fn.lower().endswith("_atlas.png"):
                    base_name = fn[:-4] #去掉.png
                    png_candidates[base_name] = fn

            for base, png_name in png_candidates.items():
                json_name = base + ".json"
                if json_name in filenames:
                    src_png = os.path.join(dirpath, png_name)
                    src_json = os.path.join(dirpath, json_name)
                    dst_png = os.path.join(out_dir, png_name)
                    dst_json = os.path.join(out_dir, json_name)

                    ok_any = False
                    try:
                        if mode in ("all", "png_only"):
                            shutil.copy2(src_png, dst_png)
                            copied_png +=1
                            ok_any = True
                        if mode in ("all", "json_only"):
                            shutil.copy2(src_json, dst_json)
                            copied_json +=1
                            ok_any = True
                        if ok_any:
                            self.log(f"处理 → {png_name}")
                            copied_group +=1
                    except Exception as e:
                        self.log(f"❌复制失败 {png_name} : {str(e)}")

        self.log(f"\n✅完成，共处理 {copied_group} 组图集")
        self.log(f"PNG复制：{copied_png} 个 | JSON复制：{copied_json} 个")
        messagebox.showinfo("完成", f"提取结束\n处理组数：{copied_group}\nPNG:{copied_png}  JSON:{copied_json}")


if __name__ == "__main__":
    tk_root = tk.Tk()
    app = AtlasExtractGUI(tk_root)
    tk_root.mainloop()