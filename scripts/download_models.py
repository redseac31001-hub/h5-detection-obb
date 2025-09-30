#!/usr/bin/env python3
"""
YOLO模型下载和转换脚本
用于将ONNX格式的YOLO模型转换为TensorFlow.js格式
"""

import os
import json
import requests
import subprocess
from pathlib import Path

def download_file(url, filepath):
    """下载文件"""
    print(f"正在下载: {url}")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"下载完成: {filepath}")

def convert_onnx_to_tfjs(onnx_path, output_dir):
    """将ONNX模型转换为TensorFlow.js格式"""
    print(f"正在转换模型: {onnx_path}")
    
    # 首先转换为TensorFlow SavedModel
    saved_model_dir = output_dir / "saved_model"
    cmd = [
        "python", "-m", "tf2onnx.convert",
        "--onnx", str(onnx_path),
        "--output", str(saved_model_dir),
        "--inputs", "images:0",
        "--outputs", "output0:0"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"ONNX转SavedModel完成: {saved_model_dir}")
    except subprocess.CalledProcessError as e:
        print(f"ONNX转换失败: {e}")
        return False
    
    # 然后转换为TensorFlow.js
    cmd = [
        "tensorflowjs_converter",
        "--input_format=tf_saved_model",
        "--output_node_names=Identity,Identity_1,Identity_2",
        "--saved_model_tags=serve",
        str(saved_model_dir),
        str(output_dir)
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"SavedModel转TensorFlow.js完成: {output_dir}")
        
        # 清理临时文件
        import shutil
        shutil.rmtree(saved_model_dir)
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"TensorFlow.js转换失败: {e}")
        return False

def create_demo_models():
    """创建演示用的简化模型文件"""
    models_dir = Path("../public/models")
    
    # 人脸检测模型
    face_model_dir = models_dir / "face_detection_model"
    face_model_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建简化的人脸检测模型配置
    face_model_config = {
        "format": "graph-model",
        "generatedBy": "1.15.0",
        "convertedBy": "TensorFlow.js Converter v3.18.0",
        "modelTopology": {
            "node": [
                {
                    "name": "input",
                    "op": "Placeholder",
                    "attr": {
                        "dtype": {"type": "DT_FLOAT"},
                        "shape": {"shape": {"dim": [
                            {"size": "1"}, {"size": "640"}, {"size": "640"}, {"size": "3"}
                        ]}}
                    }
                },
                {
                    "name": "output",
                    "op": "Identity",
                    "input": ["conv_output"],
                    "attr": {"T": {"type": "DT_FLOAT"}}
                }
            ]
        },
        "weightsManifest": [
            {
                "paths": ["group1-shard1of1.bin"],
                "weights": [
                    {"name": "conv/kernel", "shape": [3, 3, 3, 32], "dtype": "float32"},
                    {"name": "conv/bias", "shape": [32], "dtype": "float32"}
                ]
            }
        ]
    }
    
    with open(face_model_dir / "model.json", 'w') as f:
        json.dump(face_model_config, f, indent=2)
    
    # 创建空的权重文件（实际使用时需要真实的权重文件）
    with open(face_model_dir / "group1-shard1of1.bin", 'wb') as f:
        f.write(b'\x00' * 1024)  # 1KB的零填充作为占位符
    
    # 餐盘检测模型
    plate_model_dir = models_dir / "plate_detection_model"
    plate_model_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建简化的餐盘检测模型配置
    plate_model_config = {
        "format": "graph-model",
        "generatedBy": "1.15.0", 
        "convertedBy": "TensorFlow.js Converter v3.18.0",
        "modelTopology": {
            "node": [
                {
                    "name": "input",
                    "op": "Placeholder",
                    "attr": {
                        "dtype": {"type": "DT_FLOAT"},
                        "shape": {"shape": {"dim": [
                            {"size": "1"}, {"size": "640"}, {"size": "640"}, {"size": "3"}
                        ]}}
                    }
                },
                {
                    "name": "output",
                    "op": "Identity", 
                    "input": ["conv_output"],
                    "attr": {"T": {"type": "DT_FLOAT"}}
                }
            ]
        },
        "weightsManifest": [
            {
                "paths": ["group1-shard1of1.bin"],
                "weights": [
                    {"name": "conv/kernel", "shape": [3, 3, 3, 64], "dtype": "float32"},
                    {"name": "conv/bias", "shape": [64], "dtype": "float32"}
                ]
            }
        ]
    }
    
    with open(plate_model_dir / "model.json", 'w') as f:
        json.dump(plate_model_config, f, indent=2)
    
    # 创建空的权重文件
    with open(plate_model_dir / "group1-shard1of1.bin", 'wb') as f:
        f.write(b'\x00' * 2048)  # 2KB的零填充作为占位符
    
    print("演示模型文件创建完成！")
    print("注意：这些是占位符文件，实际使用时需要替换为真实的训练模型。")

def main():
    """主函数"""
    print("YOLO模型准备工具")
    print("================")
    
    choice = input("选择操作:\n1. 下载并转换真实模型\n2. 创建演示模型文件\n请输入选择 (1/2): ")
    
    if choice == "1":
        print("注意：此操作需要安装以下依赖：")
        print("- pip install tf2onnx tensorflow")
        print("- npm install -g @tensorflow/tfjs-converter")
        
        proceed = input("是否继续? (y/n): ")
        if proceed.lower() == 'y':
            # 这里可以添加真实的模型下载和转换逻辑
            print("真实模型转换功能待实现...")
        else:
            print("操作取消")
    
    elif choice == "2":
        create_demo_models()
    
    else:
        print("无效选择")

if __name__ == "__main__":
    main()