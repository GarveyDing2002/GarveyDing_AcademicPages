---
title: CLS 技术：原理、变种与设计
date: '2026-10-26'
excerpt: 梳理 Correlated Level Shifting 的基本原理、主流变种、设计权衡及其在 Pipeline-SAR 中的应用。
tags:
- 学习记录
- adc
- cls
- residue-amplifier
---

# CLS 技术：原理、变种与设计

> [!abstract] 核心定位
> 梳理 Correlated Level Shifting 的基本原理、主流变种、设计权衡及其在 Pipeline-SAR 中的应用。

---

> 说明：本文以 Zotero 中 `主题分类/Technicals/CLS` 下的 3 篇论文为核心阅读对象，并结合本地库中题名含 `CLS` / `correlated level shifting` 的相关论文梳理技术谱系。核心目录实际包含：
>
> 1. Hung and Kuo, "A 75.3-dB SNDR 24-MS/s Ring Amplifier-Based Pipelined ADC Using Averaging Correlated Level Shifting and Reference Swapping..." JSSC 2019.
> 2. Wang, Hung and Kuo, "A 15-bit 20 MS/s SHA-less Pipelined ADC Achieving 73.7 dB SNDR with Averaging Correlated Level Shifting Technique," 2019.
> 3. Wang and Kuo, "A 72-dB SNDR 130-MS/s 0.8-mW Pipelined-SAR ADC Using a Distributed Averaging Correlated Level Shifting Ring Amplifier," JSSC 2022.




## 目录

- **2026 新增专题**：见文末扩展篇章，含新增推导、文献与配图


1. CLS 的问题背景与基本原理
   - 1.1 CLS 要解决什么问题
   - 1.2 基本 CLS 原理
   - 1.3 与 CDS / auto-zero 的关系
2. CLS 技术谱系与主流变种
   - 2.1 主流技术变种
3. 代表论文与技术对比
   - 3.1 三篇 CLS 主题论文解读
   - 3.2 技术变种对比
4. 设计方法与关键 Trade-off
   - 4.1 设计 CLS 时最重要的几个问题
5. 学习路线、总结与参考文献
   - 5.1 快速入门路线
   - 5.2 一句话总结
   - 5.3 参考文献

## 1. CLS 的问题背景与基本原理

```mermaid
flowchart LR
    A[采样当前输入与残差信号] --> B[保留相关参考量]
    B --> C[按时序进行电平移位]
    C --> D[放大有效残差]
    D --> E[传递到后级并检查误差]
```

*图：CLS 的通用机制示意；具体相位与电荷关系取决于实现变种。*


### 1.1 CLS 要解决什么问题

CLS 是 Correlated Level Shifting，即“相关电平移位”。它最早主要用于 switched-capacitor 放大器和 pipeline ADC 的 MDAC / residue amplifier 中，目标不是单纯“提高 opamp 本征增益”，而是用开关电容时序把有限增益误差先估计出来，再通过电平移位让放大器在第二个相位只处理残余误差。直观地说，传统闭环 SC 放大器要求 opamp 同时满足高增益、大摆幅、高速度、低功耗；CLS 把这个问题拆成两个相位，使低/中等增益放大器也能获得高等效增益。

在 ADC 中，有限 opamp 增益会造成 residue gain error。若闭环增益为 `1/beta`，opamp 开环增益为 `A`，环路增益为 `T = A*beta`，传统闭环 residue 输出误差约与 `1/(1+T)` 成正比。对于高分辨率 pipeline 或 pipelined-SAR ADC，前级 residue amplifier 的误差会直接转化为 INL、谐波和 SNDR 限制。工艺缩放又让晶体管本征增益下降、供电电压下降、级联和 gain boosting 更难，因此单靠传统高增益 OTA 往往功耗高、速度慢、摆幅受限。

CLS 的核心价值可以概括为三点：

- 用电荷存储和电平移位提升等效环路增益，降低有限增益误差。
- 让 opamp 在精放大阶段输出摆幅显著减小，因此可用摆幅不足但高精度的小信号放大器完成大信号 SC 放大。
- 以额外时钟相位和电容网络换取放大器增益、功耗、摆幅、速度之间的新折中。


### 1.2 基本 CLS 原理

一个典型 CLS residue amplifier 包含普通 SC 反馈网络、opamp，以及一个 level-shifting capacitor `$C_LS$`。其时序一般可分为采样、估计/粗放大、level-shift/精放大三个阶段。

1. 采样相位：输入信号采样到电容阵列。
2. 第一放大相位：MDAC 或 residue amplifier 按普通闭环方式放大，输出得到一个受有限增益误差影响的估计值 `V1`。同时 `$C_LS$` 存储与该估计输出相关的电压。
3. 第二放大相位：`$C_LS$` 被重新连接到 opamp 输出或反馈节点，对 opamp 输出进行电平移位，使放大器看到的“信号主体”被抵消，只需要进一步修正第一相位留下的误差。最终输出 `V2` 更接近理想 residue。

从等效增益看，经典 CLS 可把误差从一阶有限增益误差压到近似二阶，常见表达可理解为：

```text
传统闭环：误差 ~ 1 / (A*beta)
CLS 后：  误差 ~ (1 + lambda) / (A*beta)^2
等效增益：A_EQ ~ A^2 * beta / (1 + lambda)
```

其中 `lambda` 表示 level-shift 相位中与 `$C_LS$` 发生电荷分享的负载电容与 `$C_LS$` 的比例。这个参数非常关键：`$C_LS$` 越大，电荷分享造成的衰减越小，等效增益越高；但 `$C_LS$` 越大，opamp 输出负载越重，速度越慢、功耗可能越高。因此 CLS 的设计本质是 `$A_EQ$` 与 bandwidth / settling / noise / area 的折中。

经典 CLS 的另一个重要性质是摆幅增强。第二相位中 opamp 输出端不再需要完整跟随 residue 大信号，而主要处理误差信号；这使得小输出摆幅、高增益但低供电余量的放大器可以通过 CLS 产生较大的 stage output swing。Gregoire 和 Moon 2008 年的工作展示了用只有约 30 dB loop gain 的 opamp 实现超过 60 dB 的 rail-to-rail 性能，是 CLS 技术的代表性起点。


### 1.3 与 CDS / auto-zero 的关系

CLS 容易和 CDS（correlated double sampling）混淆。二者都利用“相关性”降低放大器非理想性，但处理对象不同。

CDS 通常采样放大器 offset 或有限增益导致的误差，再从信号中扣除误差；它会把某些噪声项采样进信号路径，可能带来明显噪声惩罚。CLS 则更像是采样信号估计值并对放大器输出/反馈节点做电平移位，让放大器在第二阶段处理残差，因此在许多情况下 kT/C 噪声增加较小，甚至可获得速度优势。JSSC 2008 的经典论文强调，CLS 不只是误差扣除，更是把 opamp 的工作点和输出摆幅重新安排。

在实际 ADC 中，CLS 常与 auto-zero、chopping、ring amplifier 的 offset 消除、dynamic amplifier 的 reset 技术结合。要注意，CLS 本身主要针对有限增益和输出摆幅，并不自动解决 offset、flicker noise、PVT 漂移、开关注入、时钟馈通、比较器 offset 等问题。


## 2. CLS 技术谱系与主流变种

### 2.1 主流技术变种

#### 经典 CLS

经典 CLS 是所有后续变体的基础。其核心思想是在第一放大相位获得一个近似输出，并把该输出信息存储到 `$C_LS$`；第二相位通过电平移位把 opamp 输出拉回到更有利的工作区，使最终 residue 误差近似为二阶有限增益误差。

优点：

- 显著放松 opamp dc gain 要求。
- 支持低供电下的大 stage output swing。
- 可用中等增益、较高速度或较低功耗的放大器实现高精度 SC 放大。

限制：

- 需要额外相位，时序更复杂。
- `$C_LS$` 带来输出负载，限制带宽和 slew。
- 第二相位的 charge sharing 由 `lambda` 决定，若 `$C_LS$` 不足，等效增益提升会被打折。
- 对开关寄生、电荷注入、时钟交叠和 settling 行为敏感。

适用场景：中高分辨率 pipeline ADC、SC amplifier、需要大摆幅但 opamp 本征增益不足的场合。

#### Split-CLS

Split-CLS 的关键观察是：CLS 两个放大相位对放大器的要求不同。第一相位需要处理完整大信号、快速把输出拉到近似值；第二相位只需处理残余误差，但精度要求高。于是可以把两个相位的放大器拆开：第一相位使用快速、大摆幅、能量效率高的结构，例如 ZCBC；第二相位使用小摆幅但高精度的 opamp。

Hershberg 等 2010 年的 JSSC split-CLS pipeline ADC 用 300 mV 输出摆幅的高精度 opamp 产生 1.4 V stage output swing，证明了 split-CLS 在低供电、大摆幅、高精度之间的优势。其思想不是让一个 opamp 同时满足所有指标，而是按相位分工。

优点：

- 能把速度/摆幅和精度需求分配给不同放大器。
- 适合低供电下需要大输出摆幅的 pipeline stage。
- 可与 zero-crossing based circuit 结合，提高能效。

限制：

- 两套放大器/检测器增加复杂度和面积。
- 相位切换、kickback、power-up/down、动态偏置更难设计。
- 对时序、比较器/zero-crossing detector 动态误差敏感。

#### Asynchronous CLS

Asynchronous CLS 主要把 CLS 用于 zero-crossing based circuits，使 level-shift 相关动作不完全依赖固定时钟窗口，而由电路事件触发。它关注的是 ZCBC 中零交越检测、充放电斜率和 CLS 时序之间的配合。

核心思想：当输出接近目标值或误差被检测到时触发下一步操作，使粗放大和精修正更贴合实际 settling 过程。这类方法可减少固定时序为最坏情况预留的浪费，但引入异步控制复杂度，并对检测器延迟、噪声和 metastability 更敏感。

#### Sequential CLS

Sequential CLS 进一步利用多个顺序 level-shift 操作来获得更高等效增益。可以把它理解为把经典 CLS 的“估计一次、移位一次”扩展为多步误差压缩。Tabasy 等 2013 年提出的 sequential CLS 面向高精度 switched-capacitor 系统。

优点：

- 等效增益可进一步提升。
- 在不显著提高 opamp 本征增益的情况下逼近更高精度。

限制：

- 多相位时序增加转换时间。
- 每一步的开关误差、寄生和电荷分享会累积。
- 对高速 ADC 不一定划算，更多适合速度较低、精度要求高的 SC 系统。

#### Averaging CLS, ACLS

ACLS 是本 Zotero 主题目录中最核心的方向。它不是只用第二相位的精放大结果，而是让第一相位和第二相位的有限增益误差具有相反极性，然后在下一级采样电容中对两次输出求平均。

在 Hung and Kuo 2019 JSSC 中，ACLS 的关键机制如下：

- 第一放大相位采样 `$V_O$,A1`。
- 第二放大相位通过跨差分输出的 level shift，使有限增益误差反号，得到 `$V_O$,A2`。
- 下一级采样电容分成两组，分别采样 `A1` 和 `A2` 的输出。
- 两组电容合并后形成 `$V_O$,avg = ($V_O$,A1 + $V_O$,A2)/2`。

理想情况下，ACLS 的等效环路增益近似：

```text
T_EQ ~= T^2 / (1 + lambda)
A_EQ ~= A^2 * beta / (1 + lambda)
```

这里与经典 CLS 形式相似，但 ACLS 中第二相位只由一半的 next-stage sampling capacitance 参与电荷分享，因此 `lambd$a_ACLS$` 小于 `lambd$a_CLS$`，等效增益可更高。此外，A1 和 A2 采样的 opamp 热噪声不相关，平均后理论上可获得接近 3 dB 的 opamp thermal noise 降低。

ACLS 的额外价值在于它天然产生“两次采样平均”结构，可以和 capacitor/reference swapping 结合，降低电容随机 mismatch 和梯度 mismatch。Hung and Kuo 2019 将 ACLS 与 reference swapping 结合，在无校准 16-bit ring amplifier pipeline ADC 中实现 24 MS/s、10 MHz 输入下 74.3 dB SNDR、85.5 dB SFDR、5.1 mW。

缺点和设计注意事项：

- ACLS 依赖两次输出误差的反相和平均，两个采样电容组之间 mismatch 会限制极高分辨率场景下的可达等效增益。
- 由于第二相位的 level-shift 可能带来更强瞬态 glitch，放大器 slew rate 和大信号线性必须足够好。
- 作为偏开环的误差抵消，ACLS 对高阶放大器非线性、输出压缩更敏感；因此常配合 ring amplifier 的高 slew 和近 rail-to-rail 能力。

#### Reference Swapping, RS

RS 严格说不是 CLS 本体，而是 ACLS 结构中的重要配套技术。其利用 ACLS 两次输出平均的天然框架，在不同相位交换参考/电容连接，使同一 residue 受到的电容 mismatch 误差以可平均的方式出现。

Hung and Kuo 2019 的结果显示，RS 可以同时帮助降低 capacitor random mismatch 和 gradient mismatch 对 INL/SFDR 的影响。其意义在于：高分辨率 pipeline ADC 原本需要很大的电容和复杂 common-centroid layout；RS 让较简单电容布局也能达到足够线性，从而降低面积和功耗。

#### Weighted-Averaging CLS, WACLS

WACLS 是 ACLS 的高速/低负载变体。ACLS 为了获得对称平均和 3 dB 热噪声收益，通常需要较完整的 level-shifting capacitor 和两个采样组；这会增加 residue amplifier 输出负载。WACLS 则通过“加权平均”而非严格 1:1 平均，在等效增益消除、热噪声收益和输出负载之间重新折中。

Wang 等 2020 JSSC 的 calibration-free pipelined-SAR ADC 使用 WACLS，目标是让 `$C_LS$` 可以更小，从而缓解 RA bandwidth 限制，并在高速 pipelined-SAR 中获得更好的能效。其代价是热噪声降低不如标准 ACLS 理想，设计也更依赖权重选择和 capacitor ratio 精度。

#### Distributed CLS / Distributed ACLS, DCLS / DACLS

DACLS 是本目录中 2022 JSSC 论文的核心。它直接针对经典 CLS/ACLS 的主要瓶颈：`$C_LS$` 接在 residue amplifier 输出端，会加重主极点负载，限制 RA 带宽。DACLS 的思路是把 level-shifting networks 分布到多级放大器的内部非主极点节点，而不是堆在输出端。

在 Wang and Kuo 2022 中，三阶段 ring amplifier 的内部级间节点配置分布式 level-shift 网络。对 DCLS 而言，多次 level shift 可使等效增益进一步提高；对 DACLS 而言，通过内部差分对应节点的 level shift 加上一次输出平均，在保留 ACLS 热噪声平均优势的同时，避免输出端 `$C_LS$` 限制带宽。

可概括为：

```text
经典 CLS/ACLS：C_LS 在输出端，A_EQ 提升但输出负载增加
DACLS：C_LS 分布在内部非主极点，A_EQ 提升且主输出带宽损失小
```

该文实现了 14-bit 130 MS/s two-stage pipelined-SAR ADC，28 nm CMOS，Nyquist 输入下 72.5 dB SNDR，0.82 mW，FoM 达到 1.8 fJ/conv-step 和 181.5 dB Schreier。除了 DACLS RA，论文还结合 bypass-window backend 和 delay-reduced SAR logic，把 CLS 类技术推进到更高速、更低功耗的 pipelined-SAR 场景。

限制：

- 需要多级放大器内部节点可访问，适合 ring amplifier 或多级 OTA，不适合所有 amplifier。
- 内部节点 common-mode、PVT、非主极点稳定性和 level-shift 量需要精细设计。
- DACLS 不像经典 CLS 那样降低最终输出级大信号摆幅，因此对 ring amplifier 线性和大信号瞬态仍有要求。

#### Look-Ahead CLS

Look-ahead CLS 面向 pipelined-SAR ADC 中时间紧张的问题。传统 CLS/ACLS 需要额外相位，可能拉长 residue amplification 时间；look-ahead 的思想是利用 SAR 转换过程中已知或预测的信息，提前安排 level-shift 或 residue 处理，减少等待。

它的核心不是提高等效增益公式本身，而是改善时序利用率：将前端 SAR 的部分判决、residue 建立和后端采样重叠，使 CLS 的额外相位对总体 sampling rate 的惩罚更小。该类技术适合 pipelined-SAR，因为 SAR bit cycling 天然提供可重叠调度空间。

#### Digital CLS

Digital CLS 将“有限增益误差估计和修正”的一部分移到数字域。2024 年 Guzman 等提出的 70 dB 40 MHz pipelined-SAR with digital CLS 可看作一种把模拟 level shifting 与数字校正/数字辅助结合的方向。

其优势在于减轻模拟 `$C_LS$` 网络的精度和时序压力，尤其适合先进工艺中数字逻辑便宜、模拟增益昂贵的场景。但它通常需要额外数字估计路径、误差模型或校准/背景修正机制，且系统性能依赖误差可观测性和模型准确性。

#### Open-Then-Close / Continuous-Time Assisted CLS

2024/2025 年的 open-then-close correlated level shifting 以及 continuous-time SAR-assisted detect-and-skip 方向，重点是高速 pipelined-SAR ADC 中 residue amplifier 的 settling 和能效。传统 SC CLS 是固定相位的 closed-loop 操作；open-then-close 类方法通常先利用开环或连续时间辅助快速移动输出，再闭环/CLS 修正精度。

其核心思想：把大信号快速移动和小信号精确收敛分离。先用更快、更省电的方式接近目标，再通过 CLS 消除剩余有限增益误差。它延续了 split-CLS 的“粗/精分工”思想，但实现方式更适合高速 SAR-assisted pipeline。

#### Peak-Injection CLS

Peak-injection CLS 是面向 PVT robustness 的 switched-capacitor amplifier 技术。传统 CLS 的 level-shift 量由存储电压和电容比决定，PVT、settling 不完全、switch 非理想会造成偏差。Peak-injection 的思想是通过峰值注入或峰值相关操作增强 level-shift 量的确定性，让 SC amplifier 在工艺、电压、温度变化下保持更稳定的等效增益。

该方向适合将 CLS 从 ADC residue amplifier 扩展到更通用的 SC amplifier 模块中，尤其是需要宽 PVT 范围、低校准成本的模拟前端。

#### Cascading-CLS

Cascading-CLS 将多个 CLS 网络级联使用，目标是在不显著增加单个输出端 `$C_LS$` 负载的情况下获得更高等效增益。2025 年用于 DT 2-1 MASH ΔΣ ADC 的 cascading-CLS 把两个 CLS 网络用于 inverter-based OTA，声称在相同或更小总 CLS 电容下比传统 CLS 获得更高等效增益和更快 settling。

其思想与 sequential CLS 相近，但更强调把总电容分摊到多级/多网络中，使每个网络的负载压力下降。对于 ΔΣ / MASH ADC，有限 OTA 增益会造成模拟传递函数与数字 cancellation filter 的 mismatch，cascading-CLS 用较小硬件代价提升 OTA 等效增益，从而降低 MASH mismatch。


## 3. 代表论文与技术对比

### 3.1 三篇 CLS 主题论文解读

#### Wang, Hung and Kuo 2019：SHA-less pipelined ADC with Averaging-CLS

这篇 3 页会议论文可以看作 ACLS 在 15-bit pipeline ADC 中的紧凑实现。其问题背景是：高分辨率 pipeline ADC 前级 MDAC 需要高增益 opamp，而先进工艺中高增益、高摆幅、高速度 opamp 昂贵。作者采用 averaging-CLS 放松 opamp gain 和 thermal noise 要求，并用 ring amplifier 提高能效。

核心电路包括：

- 3.5-bit/stage flipped-around differential MDAC。
- stage 1 和 stage 2 使用 Averaging-CLS。
- 前端去掉 SHA，用 switched-capacitor comparators 实现 sub-ADC 采样，以降低功耗和成本。
- ring amplifier 使用 programmable dead-zone，兼顾 slew、速度和 PVT。

技术贡献在于把 ACLS 与 SHA-less pipeline 结合。ACLS 负责让中等精度 amplifier 达到高分辨率所需的 residue 精度；SHA-less 前端减少采样前端功耗；ring amplifier 则提供快速 slew-based charging。实测 20 MS/s 下峰值 SNDR 73.7 dB，功耗 4.7 mW，说明 ACLS 对中速高分辨率 pipeline ADC 有实用价值。

#### Hung and Kuo 2019 JSSC：ACLS + RS 的完整理论和验证

这篇是主题目录中最重要的基础论文。它系统比较了 CLS、split-CLS 和 ACLS，并给出 ACLS 的有限增益误差、噪声、`$C_LS$` 尺寸折中和 capacitor mismatch reduction 机制。

ACLS 的理论贡献：

- 通过 A1/A2 两相输出误差反相并平均，使有限增益误差抵消。
- 推导 `$T_EQ$ ~= $T^2$/(1+lambda)` 和 `$A_EQ$ ~= $A^2$ beta/(1+lambda)`。
- 指出 ACLS 的 `lambda` 通常小于经典 CLS，因为 A2 只连接一半 next-stage sampling capacitance。
- A1 和 A2 热噪声不相关，平均后可降低 opamp thermal noise。

RS 的贡献：

- 利用两次采样平均结构，对参考/电容连接进行交换。
- 降低随机 mismatch，并让简单 layout 对梯度 mismatch 更不敏感。
- 在多 bit/stage MDAC 中尤其有价值，因为传统 capacitor swapping 不一定适合 multi-bit/stage。

实测意义：

- 90 nm CMOS，16-bit ring amplifier pipeline ADC，无校准。
- 24 MS/s、10 MHz 输入下 74.3 dB SNDR、85.5 dB SFDR、5.1 mW。
- RS 打开后 INL、SFDR 明显改善，证明 mismatch reduction 不是纯理论。

设计启示：

- ACLS 特别适合“想避免数字校准，但又需要 12 ENOB 以上”的中速 pipeline ADC。
- `$C_LS$` 不是越大越好：大 `$C_LS$` 提高等效增益但降低 bandwidth，且 ACLS 第一相位输出端有较大瞬态负载。
- ring amplifier 与 ACLS 匹配度高，因为 ACLS 第二相位可能产生较强 transient glitch，需要高 slew rate。

#### Wang and Kuo 2022 JSSC：DACLS ring amplifier for pipelined-SAR

这篇论文代表 CLS 技术从中速 pipeline ADC 向高速、低功耗 pipelined-SAR ADC 的演进。pipelined-SAR 架构通常只有一个 residue amplifier，前后端 SAR 决定大部分分辨率，RA 既要高速又要高等效增益。传统 CLS/ACLS 在 RA 输出端加 `$C_LS$`，恰好压低输出主极点，成为高速瓶颈。

DACLS 的核心创新：

- 将 level-shifting networks 从 RA 输出端移到多级 ring amplifier 内部非主极点节点。
- 多个 distributed level shifts 带来更高等效增益。
- 输出端不再承受大 `$C_LS$`，RA bandwidth 得以提升。
- 保留 ACLS 的一次输出平均，使 thermal noise 仍可受益。

论文还提出：

- customized bypass-window scheme：后端 9-bit SAR 中跳过部分大电容无效切换，降低 DAC switching power。
- delay-reduced SAR logic：减少 comparator 到 DAC switch controller 的路径延迟，提高速度。
- back-end redundancy 重新配置：避免 `V1` 与 `VAvg` 不一致导致的 overflow。

实测 14-bit 130 MS/s、0.82 mW、Nyquist 输入 72.5 dB SNDR，表明 DACLS 能把 CLS 的高精度优势带到更高速度和更低功耗范围。


### 3.2 技术变种对比

| 变种                | 核心思想                                   | 主要收益                         | 主要代价                  | 适合场景                   |
| ------------------- | ------------------------------------------ | -------------------------------- | ------------------------- | -------------------------- |
| 经典 CLS            | 存储第一相位输出，第二相位电平移位修正误差 | 提升等效增益、减小 opamp 摆幅    | 额外相位、`$C_LS$` 输出负载 | SC 放大器、pipeline ADC    |
| Split-CLS           | 两相用不同放大器分工                       | 兼顾大摆幅/速度/精度             | 电路和时序复杂            | 低供电高摆幅 pipeline      |
| Sequential CLS      | 多步 level shift                           | 更高等效增益                     | 多相位、速度降低          | 高精度低速 SC 系统         |
| ACLS                | 两相误差反相并平均                         | 增益误差抵消、约 3 dB 热噪声降低 | 电容匹配限制、glitch 更强 | 中速高分辨率 pipeline      |
| ACLS + RS           | 利用平均结构交换参考/电容                  | 降低 capacitor mismatch          | 连接和时序更复杂          | 无校准高线性 ADC           |
| WACLS               | 非 1:1 加权平均                            | 减小 `$C_LS$`、提升速度            | 噪声收益折中、权重敏感    | 高速低功耗 pipelined-SAR   |
| DACLS               | `$C_LS$` 分布到内部非主极点                  | 高等效增益且输出带宽损失小       | 内部节点设计复杂          | 高速 pipelined-SAR         |
| Look-ahead CLS      | 提前安排 CLS/RA 操作                       | 缓解额外相位时间惩罚             | 调度和逻辑复杂            | 高速 SAR-assisted pipeline |
| Digital CLS         | 数字估计/修正部分误差                      | 降低模拟负担                     | 依赖模型/校准/数字逻辑    | 先进工艺数字辅助 ADC       |
| Open-then-close CLS | 先开环快速移动，再闭环/CLS 修正            | 速度高、能效好                   | 大信号非线性和切换误差    | 高速 pipelined-SAR         |
| Peak-injection CLS  | 注入/稳定 level-shift 量                   | PVT robustness                   | 机制和控制复杂            | PVT 敏感 SC amplifier      |
| Cascading-CLS       | 多 CLS 网络级联                            | 小电容下更高增益、更快 settling  | 多网络设计复杂            | ΔΣ/MASH、inverter OTA      |


## 4. 设计方法与关键 Trade-off

### 4.1 设计 CLS 时最重要的几个问题

#### `$C_LS$` 怎么选

`$C_LS$` 决定了 charge sharing 造成的 `lambda`。大 `$C_LS$` 降低 `lambda`、提高等效增益，但增加输出负载并降低第一相位 unity-gain bandwidth。小 `$C_LS$` 速度快，但 level-shift 量被负载分压，等效增益提升不足。

实用判断：

- 若目标是中速高精度，经典 CLS / ACLS 可接受较大 `$C_LS$`。
- 若目标是高速宽带，优先考虑 WACLS、DACLS、look-ahead 或 open-then-close。
- 若 opamp 输出节点已经是主极点，尽量不要在输出端堆大 `$C_LS$`，DACLS 或 cascaded/distributed 方法更合适。

#### 放大器结构如何选

CLS 可与多种 amplifier 结合：

- 传统 OTA：线性好、设计直观，但功耗和速度压力大。
- ring amplifier：slew-based charging、高能效、适合 ACLS/DACLS，但 dead-zone、PVT、稳定性和大信号非线性要处理。
- floating inverter amplifier：动态、低功耗，适合低功耗 ADC，但开环增益和 PVT 需要 CLS/辅助技术补偿。
- inverter-based OTA：简单高能效，适合 ΔΣ/MASH，常与 cascading-CLS、chopping 结合。
- ZCBC：适合 split-CLS 的粗放大阶段，但异步检测和动态误差复杂。

#### 噪声是否一定降低

经典 CLS 并不必然降低总噪声，它主要降低有限增益误差。ACLS 因为两相分别采样不相关 opamp thermal noise 并平均，理论上可以获得约 3 dB opamp thermal noise reduction。但系统总噪声还包括输入采样 kT/C、比较器噪声、reference noise、clock jitter 和后级噪声；若这些项占主导，ACLS 的 3 dB opamp noise benefit 不一定体现在最终 SNDR 上。

#### mismatch 如何处理

CLS 解决有限增益，不自动解决 capacitor mismatch。对 high-resolution pipeline ADC，电容 mismatch 往往和有限增益一样关键。ACLS + RS 的意义正在于把两次平均与 reference/capacitor swapping 结合，用架构平均来降低 mismatch 敏感性。若设计是 pipelined-SAR，前端 SAR DAC mismatch、后端 DAC mismatch、inter-stage gain error 都要同时预算。

#### 时序和 settling 是成败关键

CLS 类技术几乎都用额外相位换精度。若额外相位占用过多时间，速度优势会消失。高速设计中要特别关注：

- 第一相位粗放大是否足够快。
- level-shift 瞬间的 glitch 是否超出 amplifier slew 能力。
- 第二相位是否有足够小信号 settling 时间。
- 下一级采样是否在 residue 稳定后进行。
- SAR bit cycling 能否与 residue amplification 重叠。


## 5. 学习路线、总结与参考文献

### 5.1 快速入门路线

建议按以下顺序理解 CLS：

1. 先看经典 closed-loop SC amplifier 的有限增益误差：理解 `1/(1+A beta)` 从哪里来。
2. 看 Gregoire and Moon 2008：理解 CLS 如何把信号估计值存到 `$C_LS$`，第二相位让 opamp 只修正误差。
3. 看 Hershberg 2010 split-CLS：理解两个相位对 amplifier 的需求不同，为什么可以分工。
4. 看 Hung and Kuo 2019 JSSC：重点掌握 ACLS 的误差反相、两次采样平均、`$A_EQ$`、thermal noise reduction 和 RS。
5. 看 Wang and Kuo 2022 JSSC：理解为什么输出端 `$C_LS$` 限制带宽，以及 DACLS 如何把 CLS 分布到内部节点。
6. 再看 WACLS、look-ahead、digital CLS、open-then-close、cascading-CLS 等近期变体，把它们都归入“增益提升 vs 带宽/时序/负载/校准”的折中框架。


### 5.2 一句话总结

CLS 的本质是用开关电容记忆和电平移位，把“放大器必须一次性高增益、大摆幅、高速度完成闭环放大”的问题，改写为“先估计、再让放大器处理残差”。经典 CLS 解决有限增益和摆幅；split-CLS 按相位拆分放大器职责；ACLS 通过误差反相平均进一步降低有限增益误差和热噪声；RS 把平均结构用于 mismatch 降低；WACLS/DACLS/look-ahead/digital/open-then-close/cascading-CLS 则主要围绕高速、低功耗、低输出负载和 PVT robustness 继续演进。

对于入门者，最重要的是不要把 CLS 只理解成“加一个电容提高增益”。真正的设计主线是：`$C_LS$` 存储了什么、第二相位移位到哪里、误差极性如何变化、哪些电容参与 charge sharing、最终采样的是单相输出还是两相平均，以及这些选择如何改变等效增益、热噪声、带宽、mismatch 和时序预算。


### 5.3 参考文献

1. B. R. Gregoire and U.-K. Moon, "An over-60 dB true rail-to-rail performance using correlated level shifting and an opamp with only 30 dB loop gain," IEEE JSSC, 2008.
2. B. Hershberg, S. Weaver, and U.-K. Moon, "Design of a split-CLS pipelined ADC with full signal swing using an accurate but fractional signal swing opamp," IEEE JSSC, 2010.
3. B. Hershberg, S. Weaver, and U.-K. Moon, "A 1.4V signal swing hybrid CLS-opamp/ZCBC pipelined ADC using a 300mV output swing opamp," ISSCC, 2010.
4. S. Venkatram et al., "Asynchronous CLS for zero crossing based circuits," 2010.
5. B. Hershberg et al., "The effect of correlated level shifting on noise performance in switched capacitor circuits," ISCAS, 2012.
6. E. Tabasy et al., "Sequential correlated level shifting: a switched-capacitor approach for high-accuracy systems," 2013.
7. T.-C. Hung and T.-H. Kuo, "A 4.86 mW 15-bit 22.5 MS/s pipelined ADC with 74 dB SNDR in 90 nm CMOS using averaging correlated level shifting technique," A-SSCC, 2016.
8. T.-C. Hung and T.-H. Kuo, "A 75.3-dB SNDR 24-MS/s ring amplifier-based pipelined ADC using averaging correlated level shifting and reference swapping for reducing errors from finite opamp gain and capacitor mismatch," IEEE JSSC, 2019.
9. J.-C. Wang, T.-C. Hung, and T.-H. Kuo, "A 15-bit 20 MS/s SHA-less pipelined ADC achieving 73.7 dB SNDR with averaging correlated level shifting technique," 2019.
10. J.-C. Wang, T.-C. Hung, and T.-H. Kuo, "A calibration-free 14-b 0.7-mW 100-MS/s pipelined-SAR ADC using a weighted-averaging correlated level shifting technique," IEEE JSSC, 2020.
11. J.-C. Wang and T.-H. Kuo, "A 72-dB SNDR 130-MS/s 0.8-mW pipelined-SAR ADC using a distributed averaging correlated level shifting ring amplifier," IEEE JSSC, 2022.
12. C. Thomas et al., "Look ahead CLS in pipelined SAR ADCs," 2022.
13. A. Guzman et al., "A 70dB 40MHz pipelined-SAR with digital CLS," 2024.
14. Ye et al., "A 2mW 70.7dB SNDR 200MS/s pipelined-SAR ADC with continuous-time SAR-assisted detect-and-skip and open-then-close correlated level shifting," 2024/2025.
15. Liang et al., "A peak-injection CLS technique for PVT-robust switched-capacitor amplifier," 2025.
16. Liang et al., "A 16 kHz-BW 93.1 dB-SNDR DT 2-1 MASH delta-sigma ADC with cascading-CLS technique for accelerometer measurement applications," 2025.

## 2026 深化：CLS、ACLS、WACLS、DACLS 的误差分析与高速适用性（新增）

> [!info] 本节与原笔记关系
> 原笔记列举了不同 CLS 衍生技术。本节将 **有限环路增益误差、引入的第二相位、噪声/电容负载、RingAmp 复位特性**合并进行工程推导。推导系理想线性近似；实际 CLS 电荷关系由开关接法决定，不能把某个文献的二阶消除结果套到所有变种。

### C1. 先用反馈因子而非只用放大器 DC 增益表征误差

设闭环理想增益为 `1/β`，放大器 DC 增益为 `A0`，忽略其他误差时：

$$G_{\rm cl}=\frac{A_0}{1+A_0\beta},\qquad\frac{G_{\rm ideal}-G_{\rm cl}}{G_{\rm ideal}}=\frac{1}{1+A_0\beta}.$$

这意味着对 `G=16` 的余差放大器，如果反馈因子近似 `β=1/16`，即使 `A0=100`（40 dB），环路增益只有 6.25，静态相对误差约 `13.8%`，绝非“40 dB 已足以做 12-bit”——**这里纯粹是未补偿的简单闭环估算**，没有包括寄生反馈因子与校准。为得到高精度，通常需要更高有效环路增益、CLS 误差抵消、数字级间增益校准，或它们组合。实际 `β` 由 `C_F`、CDAC 和寄生决定，不能简单由标称 G 倒推。

![2026_05_专项机制图](/images/blog/learning-notes/correlated-level-shifting/2026_05_专项机制图.svg)

*原创专项机制示意；图中比例、相位和结构仅用于说明原理，不代表实际芯片晶体管级拓扑。*

![2026_01_CLS误差路径](/images/blog/learning-notes/correlated-level-shifting/2026_01_CLS误差路径.svg)

### C2. 两相位为何能消误差，也为何可能拖慢建立

普通闭环 settling 可以用 `e(t)≈e_0 exp(−t/τ_cl)+e_static` 近似。典型 CLS 第一放大相位先产生带静态有限增益误差的输出，同时在 CLS 电容上采样一个**与误差相关的校正量**；第二相位重新连接电容，实现放大器输出工作点移位或误差平均，使其不必再为完整大输出摆幅提供相同程度的有效增益。理想情况下残余误差可能由一阶变为高阶，但还需计入：

$$e_{\rm total}=e_{\rm finite\ gain}+e_{\rm settling}+e_{\rm charge\ injection}+e_{\rm mismatch}+e_{\rm noise}+e_{\rm timing}.$$

第二相位占用真实时间，并非免费的精度。若第一相位末未充分采样，第二相位修正的是**不准确的先验误差**，可能出现共模跃变、额外环路模式和慢尾。增加 CLS 电容还可能抬升放大器输出负载 `C_L`，减小 UGB，产生“静态更准、动态更差”的反常现象。各论文 WACLS、DACLS 即围绕电容负载、平均方式与多次 level shift 做改进。[C2][C3][C4]

### C3. 主流 CLS 分支：对准哪个痛点

|方法|核心处理|主要代价/失败机制|必看论文|
|---|---|---|---|
|CLS|第一相位估计、第二相位移位|相位长度和额外电容负载|早期 CLS 基础文献，需结合具体电路核验|
|ACLS|两个放大相位的误差有意形成相反极性并平均|平均权重、相位不对称、热噪声相关性|Hung/Kuo 2019 [C2]|
|WACLS|加权平均，缓和额外 `C_LS` 限速|权重比与失配、环路动态|Wang/Hung/Kuo 2020 [C3]|
|DACLS|分布式平均、多次 level-shifting，可不额外加载输出 CLS 电容|拓扑复杂度与切换瞬态|Wang/Kuo 2022 [C4]|
|CLS+RingAmp|以动态 RingAmp 替代传统 OTA，利用误差抑制|重启、过冲、PVT、自激/死区、CMFB|Hershberg 2012 [C1]|

![2026_02_CLS变种比较](/images/blog/learning-notes/correlated-level-shifting/2026_02_CLS变种比较.svg)

### C4. 面向 625 MS/s 余差放大的时序检查

以 `Fs=625 MS/s` 为例，`T_s=1.6 ns`。如果设计只给 MDAC 约 1/4 周期，即约 `400 ps`，需要完整列出：① SAR 最末位决策完成 ② CDAC 底板/顶板状态锁定 ③ amplifier enable 与 output common-mode precharge ④ 第一相位建立 ⑤ CLS 切换的非重叠与注入 ⑥ 第二相位收敛 ⑦ 下一级采样孔径。**400 ps 不是全部可用线性建立时间**：扣除 reset、edge skew、switch transition、采样孔径保护后才是有效窗口。

建议独立跑下列仿真而不是只看 FFT：

- 每个输入码与残差极值处的 `e_diff(t)=V_out(t)−V_ideal`，并把 `e_CM(t)` 同时画出；
- gain error 随 `Vin` 的曲线，比较 CLS on/off，检查 HD2/HD3 与偶次失真；
- 扫 `C_LS`、两相位比例、放大器偏置/级间拆分、输出负载，找到真正约束；
- TT/SS/FF、`VDD_min/max`、高低温下分别检查 startup 与终态，避免只测 27°C；
- 对电容注入进行 Monte Carlo、pex/Calibre View、输出走线寄生与 clock feedthrough 检验。

![2026_03_625M建立窗口](/images/blog/learning-notes/correlated-level-shifting/2026_03_625M建立窗口.svg)

### C5. 仿真判据、反例与参考文献

如果 `CLS on` 之后 gain error 下降、但 SFDR 不升反降，优先排查残差曲线中的**周期性误差**与第二相位未建立，而非继续无脑扩大 `C_LS`。如果 ACLS/WACLS 的推导假设两个误差完全反相关，实际版图对称、开关电荷注入、输出负载的差别会破坏这一假设。RingAmp 具有时间变化的等效工作点，用单一 LTI 相位裕度来断言全工作过程稳定是不够的，应结合 transient、PSS/PSTB（适用时）与时域最坏轨迹。

- [C1] B. P. Hershberg et al., “Ring Amplifiers for Switched-Capacitor Circuits,” *ISSCC*, 2012. [DOI:10.1109/ISSCC.2012.6177090](https://doi.org/10.1109/ISSCC.2012.6177090)。
- [C2] T.-C. Hung and T.-H. Kuo, “A 75.3-dB SNDR 24-MS/s Ring Amplifier-Based Pipelined ADC Using Averaging Correlated Level Shifting and Reference Swapping…,” *IEEE JSSC*, 2019. [DOI:10.1109/JSSC.2019.2891650](https://doi.org/10.1109/JSSC.2019.2891650)。
- [C3] J.-C. Wang, T.-C. Hung, and T.-H. Kuo, “A Calibration-Free 14-b 0.7-mW 100-MS/s Pipelined-SAR ADC Using a Weighted-Averaging Correlated Level Shifting Technique,” *IEEE JSSC*, 2020. [DOI:10.1109/JSSC.2020.3015863](https://doi.org/10.1109/JSSC.2020.3015863)。
- [C4] J.-C. Wang and T.-H. Kuo, “A 72-dB SNDR 130-MS/s 0.8-mW Pipelined-SAR ADC Using a Distributed Averaging Correlated Level Shifting Ring Amplifier,” *IEEE JSSC*, 2022. [DOI:10.1109/JSSC.2022.3196743](https://doi.org/10.1109/JSSC.2022.3196743)。
- [C5] C. C. Enz and G. C. Temes, “Circuit Techniques for Reducing the Effects of Op-Amp Imperfections: Autozeroing, Correlated Double Sampling, and Chopper Stabilization,” *Proceedings of the IEEE*, 1996. [DOI:10.1109/5.542410](https://doi.org/10.1109/5.542410)。
- [C6] K. Bult and G. J. G. M. Geelen, “A Fast-Settling CMOS Op Amp for SC Circuits With 90-dB DC Gain,” *IEEE JSSC*, 1990. [DOI:10.1109/4.62165](https://doi.org/10.1109/4.62165)。

**论文配图索引（需合法获取原文）**：C2 的 ACLS/RS 开关相位；C3 的 WACLS 电容重接方式及相位时序；C4 的 DACLS 和 RingAmp 实现。这里的三幅插图是为解释统一模型原创重绘，不宣称与原作者晶体管图完全一致。

### 定量分析图（理论/指定参数示意）

![2026_04_理论参数曲线](/images/blog/learning-notes/correlated-level-shifting/2026_04_理论参数曲线.png)

> 上图为数学模型/显式参数下计算的示意曲线，不是论文测量，也不是 TSMC 28 nm PDK 提取结果。实际结论需结合文中定义、完整寄生与时序验证。

---