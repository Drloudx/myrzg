import json
import os
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image


def split_atlas():
    root = tk.Tk()
    root.withdraw()

    # 1. 弹出文件夹选择框
    initial_dir = os.getcwd()
    folder_path = filedialog.askdirectory(title="选择包含 JSON 和 PNG 的资源文件夹", initialdir=initial_dir)
    if not folder_path:
        print("未选择文件夹，程序退出。")
        return

    # 2. 查找 JSON 文件
    json_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.json')]
    if not json_files:
        messagebox.showerror("错误", "所选文件夹中没有找到任何 JSON 文件！")
        return

    json_file = json_files[0]
    json_path = os.path.join(folder_path, json_file)

    # 3. 解析 JSON
    print(f"正在读取 JSON 文件: {json_path}")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        messagebox.showerror("错误", f"解析 JSON 文件失败:\n{e}")
        return

    sprites = data.get("mSprites", [])
    if not sprites:
        messagebox.showerror("错误", "JSON 文件中未找到 'mSprites' 数据！")
        return

    # 4. 寻找 PNG 图片
    base_name = os.path.splitext(json_file)[0]
    default_png_path = os.path.join(folder_path, base_name + ".png")

    if os.path.exists(default_png_path):
        png_path = default_png_path
    else:
        png_file = filedialog.askopenfilename(
            title="未找到同名 PNG，请手动选择对应的 PNG 图片",
            initialdir=folder_path,
            filetypes=[("PNG 图片", "*.png")]
        )
        if not png_file:
            print("未选择 PNG 图片，程序退出。")
            return
        png_path = png_file

    print(f"正在加载大图: {png_path}")
    try:
        atlas_image = Image.open(png_path)
    except Exception as e:
        messagebox.showerror("错误", f"打开图片失败:\n{e}")
        return

    # 获取大图的宽高（修复未解析引用的关键）
    img_width, img_height = atlas_image.size

    # 5. 创建输出文件夹
    output_dir = os.path.join(folder_path, f"{base_name}_splitted")
    os.makedirs(output_dir, exist_ok=True)

    # 6. 遍历切图（使用正确的 Unity 坐标转换）
    success_count = 0
    for sprite in sprites:
        name = sprite.get("name")
        x = sprite.get("x", 0)
        y = sprite.get("y", 0)
        w = sprite.get("width", 0)
        h = sprite.get("height", 0)

        if w <= 0 or h <= 0:
            continue

        # Unity 左下角原点转 Pillow 左上角原点
        # box = (x, y, x + w, y + h - 2)
        box = (x, y, x + w, y + h)

        try:
            cropped = atlas_image.crop(box)
            save_path = os.path.join(output_dir, f"{name}.png")
            cropped.save(save_path)
            success_count += 1
        except Exception as ex:
            print(f"切割子图 {name} 失败: {ex}")

    msg = f"拆图完成！\n成功保存 {success_count} 张子图到文件夹:\n{output_dir}"
    print(msg)
    messagebox.showinfo("成功", msg)


if __name__ == "__main__":
    split_atlas()