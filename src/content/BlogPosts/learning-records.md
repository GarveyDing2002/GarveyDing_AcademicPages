---
title: 学习记录索引
date: 2026-10-22
excerpt: 本页汇总研究库中的学习记录，按 ADC 系统、关键电路模块、校准方法和模拟电路基础组织。各专题笔记保留原有技术正文与参考资料。
tags:
  - 学习记录
  - index
---

> **阅读导航**
> 本页汇总研究库中的学习记录，按 ADC 系统、关键电路模块、校准方法和模拟电路基础组织。各专题笔记保留原有技术正文与参考资料。

## ADC 系统与架构

- [ADC 架构：分类、比较与选型](/GarveyDing_AcademicPages/blog/adc-architectures/) — 按原理、速度、精度与应用场景比较 ADC 架构。
- [ADC 数据输出接口：架构与设计](/GarveyDing_AcademicPages/blog/adc-data-interfaces/) — 梳理 ADC 到 FPGA、ASIC 或 MCU 的数字数据链路。
- [ADC 比较器：架构、关键指标与设计方法](/GarveyDing_AcademicPages/blog/adc-comparators/) — 覆盖比较器架构、噪声失调、时序、版图与验证。

## 校准与级间放大

- [CLS 技术：原理、变种与设计](/GarveyDing_AcademicPages/blog/correlated-level-shifting/) — 介绍 correlated level shifting 的原理、变种与设计权衡。
- [Dither-Based Calibration：原理、架构与建模](/GarveyDing_AcademicPages/blog/dither-calibration/) — 汇总基于 dither 的校准机制、架构和行为建模。
- [TI-ADC Time-Skew 校准：原理、方法与演进](/GarveyDing_AcademicPages/blog/ti-adc-time-skew/) — 对比时间交织 ADC 的偏斜检测与校正路线。

## 参考、偏置与模拟电路基础

- [模拟集成电路偏置电路](/GarveyDing_AcademicPages/blog/analog-bias-circuits/) — 从电流镜、自偏置和电压基准延伸到系统偏置分发。
- [Bandgap 基准源：架构与设计](/GarveyDing_AcademicPages/blog/bandgap-reference/) — 归纳带隙基准的原理、架构、温度补偿与验证。
- [ADC Reference Buffer（RVB）：架构与设计](/GarveyDing_AcademicPages/blog/adc-reference-buffer/) — 讨论高速 ADC 参考缓冲器的架构和动态负载设计。
- [TSMC 28 nm CMOS 片上无源器件：电阻、电容与电感](/GarveyDing_AcademicPages/blog/cmos28-passive-devices/) — 整理 28 nm CMOS 中电阻、电容和电感的实现与限制。
- [电路噪声：从 MOS 器件到系统设计](/GarveyDing_AcademicPages/blog/circuit-noise/) — 从器件噪声延伸到电路、采样与 ADC 系统预算。
- [电路零极点：原理、分析与稳定性](/GarveyDing_AcademicPages/blog/circuit-poles-and-zeros/) — 将零极点分析连接到时域响应、稳定性和建立过程。
- [PVT 对 MOS 管性能参数的影响](/GarveyDing_AcademicPages/blog/mos-pvt/) — 说明工艺、电源和温度变化对 MOS 工作点及性能的影响。

## 高速输入接口

- [高速 ADC Input Buffer：原理、架构与设计方法](/GarveyDing_AcademicPages/blog/high-speed-adc-input-buffer/) — 汇总 SF、FVF、SSF、Push-Pull 等输入缓冲结构及其与采样网络的协同。

## 建议阅读顺序

1. 先读 ADC 架构与数据输出接口，建立系统边界。
2. 按当前设计任务进入比较器、输入缓冲、参考缓冲或偏置专题。
3. 需要研究背景校准和级间放大时，再读 CLS、dither 与 time-skew 笔记。
4. 用噪声、零极点和 PVT 笔记检查跨模块的误差与验证条件。
