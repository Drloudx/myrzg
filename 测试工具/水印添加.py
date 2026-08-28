import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image

# ===================== 默认路径配置 =====================
DEFAULT_INPUT_DIR = r"E:\Desktop\html\myrzg\vue-myrzg\public\images\chara111"
DEFAULT_LOGO_PATH = r"E:\Desktop\html\myrzg\vue-myrzg\public\images\test\logo.png"
# ✅ 修改点1：扩大比例范围，上移到大腿和裙摆区域（参考黄色框）
# x1向左扩，y1向上扩，x2向右扩，y2保持在膝盖上方
DEFAULT_PROP_BOX = (0.33, 0.42, 0.68, 0.62)

# ✅ 修改点2：减小内部留白，让Logo尽可能撑满设定的比例框，显得更大
DEFAULT_PADDING = 2

DEFAULT_OPACITY = 0.45

# ✅ 修改点3：改为负数（顺时针旋转），呈现左高右低的视觉效果，贴合人物线条
DEFAULT_ROTATE = 20
# =======================================================


class WatermarkGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("批量角色立绘斜水印工具【比例版】")
        self.root.geometry("760x540")

        # 路径变量
        self.var_input_dir = tk.StringVar(value=DEFAULT_INPUT_DIR)
        self.var_logo_path = tk.StringVar(value=DEFAULT_LOGO_PATH)
        # 水印参数：比例 x1,y1,x2,y2 (0‑1)
        self.var_rotate = tk.DoubleVar(value=DEFAULT_ROTATE)
        self.var_opacity = tk.DoubleVar(value=DEFAULT_OPACITY)
        self.var_padding = tk.IntVar(value=DEFAULT_PADDING)
        self.var_prop_x1 = tk.DoubleVar(value=DEFAULT_PROP_BOX[0])
        self.var_prop_y1 = tk.DoubleVar(value=DEFAULT_PROP_BOX[1])
        self.var_prop_x2 = tk.DoubleVar(value=DEFAULT_PROP_BOX[2])
        self.var_prop_y2 = tk.DoubleVar(value=DEFAULT_PROP_BOX[3])

        main_frame = ttk.Frame(root, padding=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # --------输入目录行--------
        row = 0
        ttk.Label(main_frame, text="图片输入文件夹:").grid(row=row, column=0, sticky="w")
        ttk.Entry(main_frame, textvariable=self.var_input_dir, width=58).grid(row=row, column=1, padx=5)
        ttk.Button(main_frame, text="浏览", command=self.select_input_dir).grid(row=row, column=2)

        # --------Logo文件行--------
        row +=1
        ttk.Label(main_frame, text="水印Logo文件:").grid(row=row, column=0, sticky="w")
        ttk.Entry(main_frame, textvariable=self.var_logo_path, width=58).grid(row=row, column=1, padx=5)
        ttk.Button(main_frame, text="选择Logo", command=self.select_logo_file).grid(row=row, column=2)

        # --------参数区域--------
        row +=1
        param_frame = ttk.LabelFrame(main_frame, text="水印参数（比例0‑1，不是像素）", padding=8)
        param_frame.grid(row=row, column=0, columnspan=3, pady=8, sticky="we")

        ttk.Label(param_frame, text="旋转角度:").grid(row=0, column=0, sticky="w")
        ttk.Entry(param_frame, textvariable=self.var_rotate, width=8).grid(row=0, column=1, padx=4)

        ttk.Label(param_frame, text="透明度(0~1):").grid(row=0, column=2, sticky="w", padx=(12,0))
        ttk.Entry(param_frame, textvariable=self.var_opacity, width=8).grid(row=0, column=3, padx=4)

        ttk.Label(param_frame, text="留白像素:").grid(row=0, column=4, sticky="w", padx=(12,0))
        ttk.Entry(param_frame, textvariable=self.var_padding, width=6).grid(row=0, column=5)

        ttk.Label(param_frame, text="比例框 x1,y1,x2,y2:").grid(row=1, column=0, sticky="w", pady=(8,0))
        ttk.Entry(param_frame, textvariable=self.var_prop_x1, width=7).grid(row=1, column=1,padx=2)
        ttk.Entry(param_frame, textvariable=self.var_prop_y1, width=7).grid(row=1, column=2,padx=2)
        ttk.Entry(param_frame, textvariable=self.var_prop_x2, width=7).grid(row=1, column=3,padx=2)
        ttk.Entry(param_frame, textvariable=self.var_prop_y2, width=7).grid(row=1, column=4,padx=2)
        ttk.Label(param_frame, text="示例：0.32 0.52 0.58 0.76").grid(row=1, column=6, padx=(8,0))

        # --------按钮--------
        row +=1
        btn_frame = ttk.Frame(main_frame)
        btn_frame.grid(row=row, column=0, columnspan=3, pady=5)
        ttk.Button(btn_frame, text="开始批量处理", command=self.run_batch).pack()

        # --------日志输出框--------
        row +=1
        ttk.Label(main_frame, text="处理日志:").grid(row=row, column=0, sticky="w")
        row +=1
        log_frame = ttk.Frame(main_frame)
        log_frame.grid(row=row, column=0, columnspan=3, sticky="nsew")
        self.log_text = tk.Text(log_frame, height=12)
        self.log_text.pack(fill=tk.BOTH, expand=True)

        main_frame.rowconfigure(row, weight=1)
        main_frame.columnconfigure(1, weight=1)

    def log(self, msg):
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.root.update_idletasks()

    def select_input_dir(self):
        d = filedialog.askdirectory(initialdir=self.var_input_dir.get(), title="选择图片文件夹")
        if d:
            self.var_input_dir.set(d)

    def select_logo_file(self):
        f = filedialog.askopenfilename(initialfile=self.var_logo_path.get(),
                                       filetypes=[("PNG图片","*.png"),("所有文件","*.*")],
                                       title="选择透明Logo(png)")
        if f:
            self.var_logo_path.set(f)

    def process_single_image(self, in_img_path, out_img_path, logo_img):
        prop_x1 = self.var_prop_x1.get()
        prop_y1 = self.var_prop_y1.get()
        prop_x2 = self.var_prop_x2.get()
        prop_y2 = self.var_prop_y2.get()
        padding = self.var_padding.get()
        opacity = self.var_opacity.get()
        rotate_angle = self.var_rotate.get()

        bg = Image.open(in_img_path).convert("RGBA")
        w, h = bg.size
        # ✅按图片实际宽高，把比例转为真实像素框
        x1 = int(w * prop_x1)
        y1 = int(h * prop_y1)
        x2 = int(w * prop_x2)
        y2 = int(h * prop_y2)

        avail_w = x2 - x1 - padding*2
        avail_h = y2 - y1 - padding*2

        logo = logo_img.copy()
        # thumbnail缩放允许LANCZOS
        logo.thumbnail((avail_w, avail_h), Image.Resampling.LANCZOS)
        # rotate不支持LANCZOS，改用BICUBIC高质量旋转
        # rotate不支持LANCZOS，改用BICUBIC高质量旋转
        logo = logo.rotate(rotate_angle, resample=Image.Resampling.BICUBIC, expand=True)

        r,g,b,a = logo.split()
        a = a.point(lambda v: int(v * opacity))
        logo.putalpha(a)

        paste_x = x1 + padding + (avail_w - logo.width)//2
        paste_y = y1 + padding + (avail_h - logo.height)//2

        bg.paste(logo, (paste_x, paste_y), mask=logo)
        bg.save(out_img_path)

    def run_batch(self):
        from PIL import Image
        self.log(f"✅Pillow版本: {Image.__version__}")
        input_dir = self.var_input_dir.get()
        logo_path = self.var_logo_path.get()
        if not os.path.isdir(input_dir):
            messagebox.showerror("错误", f"输入目录不存在：{input_dir}")
            return
        if not os.path.isfile(logo_path):
            messagebox.showerror("错误", f"水印文件不存在：{logo_path}")
            return

        output_dir = os.path.join(input_dir, "output")
        os.makedirs(output_dir, exist_ok=True)
        self.log(f"输入目录:{input_dir}")
        self.log(f"输出目录:{output_dir}")

        try:
            logo_img = Image.open(logo_path).convert("RGBA")
        except Exception as e:
            messagebox.showerror("打开Logo失败", str(e))
            return

        img_exts = {".png",".jpg",".jpeg",".bmp"}
        file_list = [f for f in os.listdir(input_dir) if os.path.splitext(f)[1].lower() in img_exts]
        self.log(f"发现图片 {len(file_list)} 张\n")

        ok_cnt = 0
        for fname in file_list:
            in_path = os.path.join(input_dir, fname)
            out_path = os.path.join(output_dir, fname)
            try:
                self.log(f"处理：{fname}")
                self.process_single_image(in_path, out_path, logo_img)
                ok_cnt +=1
            except Exception as e:
                self.log(f"❌失败 {fname} : {str(e)}")

        self.log(f"\n✅处理完成，成功:{ok_cnt}/{len(file_list)}，输出到output文件夹")
        messagebox.showinfo("完成", f"处理结束，成功{ok_cnt}张，输出在输入目录output子文件夹")


if __name__ == "__main__":
    root = tk.Tk()
    app = WatermarkGUI(root)
    root.mainloop()