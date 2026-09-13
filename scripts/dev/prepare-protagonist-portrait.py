"""调用现有水印添加.py 的处理方法，仅生成主角男立绘；原图和压缩前图均备份。"""
import importlib.util
import argparse
from datetime import datetime
from pathlib import Path
import shutil
from types import SimpleNamespace

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace", action="store_true", help="备份已有结果后，从原图重新处理")
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[2]
    source = project.parent / "4.24路资源包/assets/res/texture/chara/l/chara001b_0.png"
    tool = project.parent / "DeepSeekflash/测试工具/水印添加.py"
    logo = project / "public/images/test/logo.png"
    relative = Path("chara/protagonist/chara001b_0.png")
    output = project / "public/images" / relative
    backups = project.parent / "vue-myrzg备份-资源"
    original = backups / "protagonist-original/chara001b_0.png"
    watermarked = backups / "images" / relative
    if output.exists() or watermarked.exists():
        if not args.replace:
            raise FileExistsError("已存在处理结果；明确重做时使用 --replace，从原图重做而不叠水印")
        history = backups / "protagonist-processing-history" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        history.mkdir(parents=True, exist_ok=False)
        if output.exists():
            shutil.copy2(output, history / "compressed.png")
        if watermarked.exists():
            shutil.copy2(watermarked, history / "watermarked.png")
    for path in (output, original, watermarked):
        path.parent.mkdir(parents=True, exist_ok=True)
    if original.exists():
        if original.read_bytes() != source.read_bytes():
            raise ValueError("已有原图备份与来源不符")
    else:
        shutil.copy2(source, original)
    spec = importlib.util.spec_from_file_location("project_watermark", tool)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # 复用 GUI 的原始处理算法和默认参数，不启动图形窗口。
    def value(v):
        return SimpleNamespace(get=lambda: v)
    processor = SimpleNamespace(**{
        **dict(zip(
            ("var_prop_x1", "var_prop_y1", "var_prop_x2", "var_prop_y2"),
            # 男主画布比女主窄，比例框由 35% 放宽到 52%，保持中心不变。
            map(value, (0.245, 0.40, 0.765, 0.64)),
        )),
        "var_padding": value(module.DEFAULT_PADDING),
        "var_opacity": value(module.DEFAULT_OPACITY),
        "var_rotate": value(module.DEFAULT_ROTATE),
    })
    with Image.open(logo) as image:
        module.WatermarkGUI.process_single_image(processor, source, output, image.convert("RGBA"))
    shutil.copy2(output, watermarked)
    print(f"原图: {source.stat().st_size} bytes; 水印版: {output.stat().st_size} bytes")
    print(f"输出: {output}")
    print(f"压缩前备份: {watermarked}")


if __name__ == "__main__":
    main()
