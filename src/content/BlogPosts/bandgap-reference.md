---
title: Bandgap 基准源：架构与设计
date: 2026-06-10
excerpt: 从 CTAT/PTAT 原理到经典、低压、曲率补偿和先进工艺架构，建立 Bandgap 设计与选型框架。
tags:
  - 学习记录
  - 模拟集成电路
  - analog-ic
  - bandgap
  - voltage-reference
  - adc
---

> **核心定位**
> 从 CTAT/PTAT 原理到经典、低压、曲率补偿和先进工艺架构，建立 Bandgap 设计与选型框架。

---

> **笔记结构**
> 主体按架构谱系组织；附录保留原笔记中独有的发展脉络、Song–Gray 曲率补偿、可流片检查项，以及面向 28 nm 高速 ADC 的选型建议。

> 本文面向模拟/混合信号 IC 设计学习，重点梳理 bandgap reference 的主要结构谱系：从经典 Widlar/Kuijk/Brokaw 电压模结构，到 Banba 电流模低压结构，再到曲率补偿、MOS-only、resistorless、time-domain、FinFET 先进工艺结构，以及高速 ADC 中的 reference 系统实现。

---


> **层次化结构**
> 本版将原来 27 个并列章节重构为 **8 个主章节 → 主题小节 → 具体架构/推导/指标**。技术内容保持不变，只调整阅读层级。

## 目录

1. Bandgap 的物理基础与总体框架
   - 1.1 Bandgap 到底解决什么问题
   - 1.2 CTAT、PTAT 与一阶温度补偿
   - 1.3 架构谱系总览
2. 经典电压模 Bandgap：Widlar、Kuijk 与 Brokaw
   - 2.1 经典电压模的统一结构
   - 2.2 Widlar 型
   - 2.3 Kuijk 型
   - 2.4 Brokaw Cell
3. 低压与电流模 Bandgap：Banba、Sub-Bandgap 与 Low-Voltage CMOS
   - 3.1 电流模 Bandgap 的统一思想
   - 3.2 Banba 型 Bandgap
   - 3.3 Sub-bandgap / Fractional Bandgap
   - 3.4 低压 CMOS Bandgap
4. 高精度温度补偿：曲率补偿及代表结构
   - 4.1 曲率补偿的必要性与主要方法
   - 4.2 Rincón-Mora–Allen 分段曲率补偿
   - 4.3 Malcovati / Leung-Mok 等低压曲率补偿
5. 器件与新型实现：寄生 BJT、MOS-only、Resistorless 与 Time-Domain
   - 5.1 CMOS 寄生 BJT / Diode-based Bandgap
   - 5.2 MOS-only / Subthreshold Voltage Reference
   - 5.3 Resistorless / Switched-Capacitor Reference
   - 5.4 Time-domain / Digital-like Bandgap
6. 先进工艺与系统增强：FinFET、PSRR 与数字校准
   - 6.1 先进 FinFET 工艺下的 Bandgap
   - 6.2 高 PSRR Bandgap
   - 6.3 Digitally Trimmed / Calibration-Assisted Bandgap
7. Bandgap 在 ADC Reference System 中的角色
   - 7.1 Bandgap + Reference Buffer / LDO 系统结构
   - 7.2 不同应用场景下的结构选择
   - 7.3 主要结构对比
8. 学习路线、参考文献与工程附录
   - 8.1 推荐学习路线
   - 8.2 核心参考文献
   - 8.3 最终总结

## 1. Bandgap 的物理基础与总体框架

### 1.1 Bandgap 到底解决什么问题

Bandgap reference，简称 **BGR**，是模拟芯片中最基础、最常用的参考源之一。它的目标是在温度、工艺、电源电压变化下，产生稳定的参考电压或参考电流。

Bandgap 的典型应用包括：

- ADC / DAC 的参考电压；
- LDO / DC-DC 的反馈基准；
- 温度传感器中的 PTAT / CTAT 信号源；
- PLL、振荡器、bias generator；
- PMIC 中的内部基准；
- SoC 中的 PVT monitor；
- 高精度传感器前端；
- 校准电路中的稳定参考。

Bandgap 的核心思想不是“做一个 1.2 V 电压源”，而是：


$$
\boxed{
\text{CTAT} + \text{PTAT} \rightarrow \text{近似零温度系数}
}
$$


其中：

- **CTAT**：Complementary to Absolute Temperature，随温度升高而下降；
- **PTAT**：Proportional to Absolute Temperature，随绝对温度升高而上升。

传统 BJT bandgap 用的是：


$$
V_{BE} \quad \text{作为 CTAT}
$$



$$
\Delta V_{BE}=V_T\ln N \quad \text{作为 PTAT}
$$


然后构造：


$$
V_{REF}=V_{BE}+K\Delta V_{BE}
$$


当 $K$ 选得合适时，一阶温度系数可以抵消。

---


### 1.2 CTAT、PTAT 与一阶温度补偿

#### BJT 的 $V_{BE}$ 为什么是 CTAT

BJT 的集电极电流近似为：


$$
I_C=I_S\exp\left(\frac{V_{BE}}{V_T}\right)
$$


其中：


$$
V_T=\frac{kT}{q}
$$


所以：


$$
V_{BE}=V_T\ln\left(\frac{I_C}{I_S}\right)
$$


虽然 $V_T$ 随温度升高而增加，但 $I_S$ 随温度上升增加得更快，所以在固定电流下，$V_{BE}$ 总体随温度升高而下降。室温附近常见斜率为：


$$
\frac{\partial V_{BE}}{\partial T}\approx -1.5\sim -2.2\ \text{mV}/^\circ\text{C}
$$


因此 $V_{BE}$ 是一个 CTAT 电压。

#### $\Delta V_{BE}$ 为什么是 PTAT

两个 BJT 具有不同电流密度：


$$
J_1,\quad J_2
$$


其 $V_{BE}$ 差值为：


$$
\Delta V_{BE}=V_T\ln\left(\frac{J_1}{J_2}\right)
$$


若电流密度比为 $N$，则：


$$
\boxed{
\Delta V_{BE}=V_T\ln N=\frac{kT}{q}\ln N
}
$$


因为 $V_T$ 与绝对温度 $T$ 成正比，所以 $\Delta V_{BE}$ 是 PTAT 电压。

#### 一阶温度补偿

构造：


$$
V_{REF}=V_{BE}+K\Delta V_{BE}
$$


温度系数为：


$$
\frac{dV_{REF}}{dT}
=
\frac{dV_{BE}}{dT}
+
K\frac{d\Delta V_{BE}}{dT}
$$


令其为零：


$$
\frac{dV_{REF}}{dT}=0
$$


得到：


$$
K
=
-\frac{dV_{BE}/dT}
{d\Delta V_{BE}/dT}
$$


由于：


$$
\frac{d\Delta V_{BE}}{dT}
=
\frac{k}{q}\ln N
$$


所以：


$$
K=
-\frac{dV_{BE}/dT}
{(k/q)\ln N}
$$


例如 $N=8$ 时：


$$
\frac{k}{q}\ln 8
\approx 86.17\ \mu\text{V}/K \times 2.079
\approx 179\ \mu\text{V}/K
$$


若：


$$
\frac{dV_{BE}}{dT}\approx -1.8\ \text{mV}/K
$$


则：


$$
K\approx 10
$$


这就是传统 bandgap 中 PTAT 项需要被放大约 8–12 倍的原因。

#### 为什么传统 Bandgap 接近 1.2 V

室温附近：


$$
V_{BE}\approx 0.65\sim0.75\ \text{V}
$$


而：


$$
K\Delta V_{BE}\approx0.45\sim0.55\ \text{V}
$$


所以：


$$
V_{REF}\approx1.2\sim1.25\ \text{V}
$$


这个数值接近硅的 bandgap voltage，因此称为 bandgap reference。

但要注意：


$$
\boxed{
\text{Bandgap 的本质是温度补偿，不是必须输出 1.2 V}
}
$$


低压 current-mode BGR、fractional BGR、MOS-only reference 都可以输出低于 1.2 V 的参考电压。

#### CTAT/PTAT 补偿示意图

![02_ctat_ptat_compensation](/GarveyDing_AcademicPages/images/blog/learning-notes/bandgap-reference/02_ctat_ptat_compensation.png)

图中可以看到，$V_{BE}$ 随温度下降，放大后的 $\Delta V_{BE}$ 随温度上升，两者相加后得到近似平坦的 $V_{REF}$。实际电路中，最终曲线不会完全平坦，因为 $V_{BE}(T)$ 存在二阶和高阶曲率。

---


### 1.3 架构谱系总览

Bandgap / voltage reference 的结构谱系可以概括如下：

![01_bandgap_architecture_taxonomy](/GarveyDing_AcademicPages/images/blog/learning-notes/bandgap-reference/01_bandgap_architecture_taxonomy.png)

从图中可以看到，bandgap 的主线大致分为：

1. 经典电压模；
2. 电流模低压；
3. 曲率补偿；
4. MOS-only / subthreshold；
5. time-domain / digital-like；
6. 系统级 BGR + trim + buffer/LDO + decap。

---


## 2. 经典电压模 Bandgap：Widlar、Kuijk 与 Brokaw

### 2.1 经典电压模的统一结构

#### 基本结构

经典电压模 bandgap 直接在电压域实现：


$$
V_{REF}=V_{BE}+K\Delta V_{BE}
$$


其中：

- $V_{BE}$：CTAT；
- $\Delta V_{BE}$：PTAT；
- $K$：由电阻比、电流比或增益网络决定。

#### 典型结构

经典电压模结构包括：

- Widlar 型；
- Kuijk 型；
- Brokaw 型；
- 一些早期 CMOS / BiCMOS BGR。

#### 电路组成

一个典型电压模 BGR 通常包含：

1. 两个不同电流密度的 BJT；
2. 产生 $\Delta V_{BE}$ 的电阻；
3. 放大 $\Delta V_{BE}$ 的电阻比；
4. 将 $V_{BE}$ 与 PTAT 项叠加的节点；
5. 运放或反馈环路；
6. startup 电路；
7. 可选 trim 网络；
8. 可选输出 buffer。

#### 优点

| 优点 | 说明 |
|---|---|
| 结构经典成熟 | Widlar/Kuijk/Brokaw 架构已被长期验证 |
| 精度潜力高 | BJT 温度特性相对稳定 |
| 理论清楚 | 易于推导和验证 |
| 工程经验丰富 | LDO、PMIC、ADC 前级常用 |
| 适合 trim | 电阻比和电流比可通过 fuse/DAC 修正 |

#### 缺点

| 缺点 | 说明 |
|---|---|
| 输出接近 1.2 V | 不适合 sub-1-V 电源直接工作 |
| headroom 要求高 | BJT、运放、电流镜都需要压降余量 |
| 低压工艺难照搬 | 先进 CMOS/FinFET 核心电源较低 |
| startup 必须设计 | 自偏置环路可能存在零电流稳定点 |
| PSRR 需优化 | 电源噪声可通过电流镜和运放耦合到输出 |

#### 适用场景

经典电压模 BGR 适合：

- 1.8 V / 2.5 V / 3.3 V 模拟电源；
- 高精度 LDO；
- PMIC；
- ADC/DAC 主基准前级；
- 片上温度传感器；
- 需要 ppm/°C 级温漂的电路。

---


### 2.2 Widlar 型

#### 定位

Widlar 型是 bandgap reference 的早期原型。它的重要性在于提出并实践了：


$$
V_{BE}+K\Delta V_{BE}
$$


这一基本补偿思想。

#### 结构特点

Widlar 型一般利用 BJT 的 $V_{BE}$ 作为 CTAT，再利用不同电流密度 BJT 产生 $\Delta V_{BE}$ 作为 PTAT，最后通过比例关系求和。

#### 优点

- 是理解 bandgap 的起点；
- 直接体现 $V_{BE}$ 与 $\Delta V_{BE}$ 的组合；
- 对早期集成稳压器具有重要意义。

#### 缺点

- 现代设计中很少直接照搬原始结构；
- 对低压供电不友好；
- 对启动、PSRR、基极电流误差的工程处理不如后续结构完整；
- 更适合作为概念结构学习。

#### 学习重点

学习 Widlar 型时重点看：

1. $V_{BE}$ 的负温度系数；
2. $\Delta V_{BE}$ 的正温度系数；
3. 一阶温度系数抵消；
4. 输出接近硅 bandgap voltage 的物理意义。

---


### 2.3 Kuijk 型

#### 定位

Kuijk 型是经典的 **op-amp feedback voltage reference**。它比早期结构更系统地利用运放反馈建立支路电流关系。

#### 基本工作方式

典型 Kuijk 型结构中：

1. 两个 BJT 具有不同面积或电流密度；
2. 运放强制两个节点电压相等；
3. 两个 BJT 的 $V_{BE}$ 差出现在电阻上；
4. 该电阻电流为 PTAT；
5. PTAT 电流通过另一电阻形成 PTAT 电压；
6. PTAT 电压与 $V_{BE}$ 相加得到 $V_{REF}$。

#### 关键关系


$$
\Delta V_{BE}=V_T\ln N
$$



$$
I_{PTAT}=\frac{\Delta V_{BE}}{R_1}
$$



$$
V_{REF}=V_{BE}+I_{PTAT}R_2
$$


所以：


$$
V_{REF}=V_{BE}+\frac{R_2}{R_1}\Delta V_{BE}
$$


#### 优点

- 运放反馈使工作点明确；
- 原理直观；
- 适合教学和标准 CMOS 寄生 BJT 实现；
- 电阻比可以设定温度系数。

#### 缺点

- 运放 offset 会破坏支路电压相等；
- 运放有限增益导致支路误差；
- 运放输入共模范围限制低压工作；
- 需要频率补偿；
- startup 不可忽略。

#### 设计关注点

| 关注点 | 说明 |
|---|---|
| 运放 offset | 直接转化为 $\Delta V_{BE}$ 误差 |
| 运放增益 | 决定节点强制相等的精度 |
| BJT 面积比 | 决定 $\Delta V_{BE}$ |
| 电阻比 | 决定 PTAT 放大系数 |
| 电源抑制 | 运放和电流源的 PSRR 很重要 |
| 启动 | 避免零电流工作点 |

---


### 2.4 Brokaw Cell

#### 定位

Brokaw cell 是最经典、最常被工业界使用的人名 bandgap 架构之一，也常被称为：


$$
\text{two-transistor bandgap reference}
$$


它是高精度电压模 bandgap 的代表。

#### 基本结构

Brokaw cell 通常包含：

- 两个 BJT；
- 两个或多个电阻；
- 运放或等效反馈环路；
- 电流镜；
- startup；
- 输出节点。

两个 BJT 工作在不同电流密度下，产生：


$$
\Delta V_{BE}=V_T\ln N
$$


这个差值通过电阻产生 PTAT 电流：


$$
I_{PTAT}=\frac{\Delta V_{BE}}{R_1}
$$


然后叠加到某个 $V_{BE}$ 上：


$$
V_{REF}=V_{BE}+I_{PTAT}R_2
$$


最终得到：


$$
\boxed{
V_{REF}=V_{BE}+\frac{R_2}{R_1}\Delta V_{BE}
}
$$


#### Brokaw Cell 的核心优势

| 优势 | 说明 |
|---|---|
| 对称 two-transistor cell | 有利于匹配 |
| 电流密度比明确 | $\Delta V_{BE}$ 可预测 |
| 工业验证充分 | 大量 PMIC/LDO/ADC 中使用 |
| 适合 trimming | 可修正输出和温漂 |
| 可扩展曲率补偿 | 可加入高阶补偿电流 |
| 可优化 PSRR | 可结合 pre-regulator、cascode、buffer |

#### 主要非理想因素

#### BJT mismatch

两个 BJT 的 $V_{BE}$ mismatch 会直接造成输出初始误差。

#### 面积比误差

面积比偏差导致：


$$
\Delta V_{BE}=V_T\ln N
$$


中的 $N$ 偏差，从而改变 PTAT 权重。

#### 电阻比误差


$$
\frac{R_2}{R_1}
$$


直接决定 PTAT 放大倍数，电阻 mismatch 会导致一阶温度系数偏差。

#### 运放 offset

运放 offset 会使两个关键节点不再相等，造成支路电流误差。

#### Base current error

BJT 的基极电流流过电阻，会改变理想电阻电流，尤其在寄生 PNP $\beta$ 较低时更加明显。

#### 设计重点

Brokaw cell 设计时需要重点验证：

- DC 工作点；
- startup；
- loop stability；
- PSRR；
- output noise；
- Monte Carlo mismatch；
- 电阻 TCR；
- BJT 模型可靠性；
- 高温漏电；
- trim range；
- post-layout 寄生；
- 封装应力。

#### 适用场景

Brokaw cell 非常适合：

- 1.8 V 以上供电；
- 高精度 LDO；
- PMIC；
- ADC/DAC reference 前级；
- 温度传感器；
- 精密偏置系统。

如果供电只有 1.0 V 或更低，传统 Brokaw cell 通常不适合直接使用，需要改成 low-voltage / current-mode / sub-bandgap 结构。

---


## 3. 低压与电流模 Bandgap：Banba、Sub-Bandgap 与 Low-Voltage CMOS

### 3.1 电流模 Bandgap 的统一思想

#### 架构定位

电流模 bandgap 的核心思想是：


$$
\boxed{
\text{先把 CTAT/PTAT 电压转换成电流，再在电流域相加}
}
$$


它不再直接输出：


$$
V_{BE}+K\Delta V_{BE}
$$


而是生成：


$$
I_{CTAT}=\frac{V_{BE}}{R_C}
$$



$$
I_{PTAT}=\frac{\Delta V_{BE}}{R_P}
$$


然后：


$$
I_{REF}=I_{CTAT}+I_{PTAT}
$$


最后：


$$
V_{REF}=I_{REF}R_O
$$


#### 电压模与电流模对比

![03_voltage_mode_vs_current_mode](/GarveyDing_AcademicPages/images/blog/learning-notes/bandgap-reference/03_voltage_mode_vs_current_mode.png)

#### 电流模的核心优势

传统电压模：


$$
V_{REF}\approx1.2\ \text{V}
$$


电流模：


$$
V_{REF}=R_O(I_{CTAT}+I_{PTAT})
$$


通过选择：


$$
R_O/R_C,\quad R_O/R_P
$$


可以得到低于 1.2 V 的输出。

例如：


$$
V_{REF}=0.5\ \text{V}
$$


或者：


$$
V_{REF}=0.6\ \text{V}
$$


#### 典型代表

- Banba 型 sub-1-V BGR；
- Rincón-Mora–Allen current-mode BGR；
- 一些 low-voltage CMOS BGR；
- 多输出 fractional BGR；
- 先进 FinFET current-mode BGR。

#### 优点

| 优点 | 说明 |
|---|---|
| 低压友好 | 输出可低于 1.2 V |
| 输出可缩放 | 电阻比决定输出 |
| 可同时生成电流基准 | 便于 bias 分发 |
| 易生成多个参考 | 多输出 SoC reference 方便 |
| 适合先进工艺 | 可适配低 VDD |

#### 缺点

| 缺点 | 说明 |
|---|---|
| 电流镜 mismatch 敏感 | PTAT/CTAT 比例受影响 |
| 电流镜有限 $r_o$ | line regulation 和 PSRR 变差 |
| 运放 offset 仍关键 | 影响电流生成精度 |
| 电阻 TCR 复杂 | 不同电阻温漂影响求和比例 |
| 内部 headroom 仍有限 | 输出低不代表所有节点都低 |
| 噪声路径更多 | 电流镜和输出电阻噪声都重要 |

---


### 3.2 Banba 型 Bandgap

#### 定位

Banba 型是最经典的 **sub-1-V current-mode bandgap**。它的核心目标是解决：


$$
V_{REF}\approx1.2\ \text{V}
$$


导致传统 bandgap 无法在低于 1.2 V 的电源下工作的矛盾。

#### 基本公式

Banba 型可以写成：


$$
V_{REF}
=
R_4
\left(
\frac{V_{BE}}{R_2}
+
\frac{\Delta V_{BE}}{R_3}
\right)
$$


其中：


$$
\frac{V_{BE}}{R_2}
$$


是 CTAT 电流；


$$
\frac{\Delta V_{BE}}{R_3}
$$


是 PTAT 电流。

最后由 $R_4$ 转成电压。

#### 和传统 BGR 的对比

传统电压模：


$$
V_{REF}=V_{BE}+K\Delta V_{BE}
$$


Banba 电流模：


$$
V_{REF}=R_4\left(\frac{V_{BE}}{R_2}+\frac{\Delta V_{BE}}{R_3}\right)
$$


如果设：


$$
\frac{R_4}{R_2}<1
$$


则输出可以被压低。

#### 为什么能 sub-1-V

传统结构在输出节点上直接堆叠：


$$
V_{BE}+K\Delta V_{BE}
$$


所以输出自然接近 1.2 V。

Banba 型在内部生成电流，再由输出电阻转换：


$$
V_{REF}=I_{SUM}R_4
$$


所以 $V_{REF}$ 可以通过电阻比缩放。输出可以是：


$$
0.4\ \text{V},\quad 0.5\ \text{V},\quad 0.6\ \text{V}
$$


这使它很适合低压 CMOS。

#### 设计重点

Banba 型设计中需要特别关注：

1. 运放输入共模范围；
2. 电流镜 headroom；
3. PMOS/NMOS 电流镜 mismatch；
4. $R_2$、$R_3$、$R_4$ 的匹配；
5. 电阻 TCR；
6. startup；
7. 输出噪声；
8. PSRR；
9. 高温漏电；
10. 低温低压启动；
11. Monte Carlo 下的温漂分布。

#### 优点与缺点

| 项目 | 说明 |
|---|---|
| 优点 | sub-1-V 输出、低压友好、输出可缩放 |
| 缺点 | 对电流镜、电阻比、运放 offset 更敏感 |
| 适合 | 1 V 左右 CMOS、低压 SoC、先进工艺低压 reference |
| 不适合 | 无 trim 且要求极高绝对精度的场景 |

#### 对 ADC 的意义

对于 ADC，Banba 型可以生成低压 reference core，例如：


$$
0.5\ \text{V}
$$


但它通常仍然不直接驱动 ADC CDAC，而是作为 reference buffer 或 reference LDO 的输入基准。

---


### 3.3 Sub-bandgap / Fractional Bandgap

#### 概念

Sub-bandgap 指输出低于传统硅 bandgap 电压的参考源：


$$
V_{REF}<1.2\ \text{V}
$$


它不一定是一种独立拓扑，而是一类输出策略。

#### 常见实现方法

#### Current-mode scaling

即 Banba 思路：


$$
V_{REF}=R_O(I_{CTAT}+I_{PTAT})
$$


#### Fractional scaling

先产生：


$$
V_{BG}\approx1.2\ \text{V}
$$


再通过比例缩放：


$$
V_{REF}=\alpha V_{BG}
$$


其中：


$$
0<\alpha<1
$$


#### Multi-output bandgap

在一个 bandgap 中同时产生：


$$
1.2\ \text{V},\quad0.8\ \text{V},\quad0.6\ \text{V},\quad0.4\ \text{V}
$$


#### Low-current-density BJT

通过降低 BJT 电流密度降低 $V_{BE}$，以适配低压。

#### 优点

- 适合低压 SoC；
- 可以直接提供低压 reference；
- 与数字 trim 兼容；
- 可以减少后级分压；
- 适合多电源域系统。

#### 缺点

- 若用分压，分压电阻引入噪声；
- 若用电流模，电流镜误差关键；
- 输出变低后噪声占比可能变大；
- 低压下 buffer 设计仍困难；
- sub-bandgap 不等于高精度。

---


### 3.4 低压 CMOS Bandgap

#### 背景

传统 BGR 在 5 V、3.3 V、1.8 V 电源下较容易工作。但进入 1.2 V、1.0 V、0.8 V 供电后，传统电压模 BGR 变困难。

主要限制来自：

- 输出接近 1.2 V；
- 运放输入共模不足；
- 电流镜压降不足；
- BJT $V_{BE}$ 占据过多 headroom；
- startup 难度增加；
- 环路增益下降。

#### 主要结构路线

#### 路线一：Banba-like current-mode BGR

最经典、最直接。

#### 路线二：不使用 low-$V_{TH}$ 器件的低压 BGR

代表是 Leung–Mok 类结构，目标是在标准 CMOS 中实现 sub-1-V，不依赖特殊低阈值器件。

#### 路线三：弱反型运放 / inverter-based amplifier

用低电压放大器替代传统高增益运放。

#### 路线四：current-mode + self-biased mirror

降低电压堆叠，提高低压适应性。

#### 路线五：subthreshold MOS / MOS-only reference

当精度要求低、功耗要求极低时使用。

#### 低压设计难点

| 难点 | 说明 |
|---|---|
| BJT $V_{BE}$ 高 | 单个结电压已经接近 0.6–0.8 V |
| 运放输入共模 | 低 VDD 下输入对管可能不工作 |
| 电流镜余量 | cascode 很难使用 |
| PSRR 下降 | 电流源更容易被电源调制 |
| startup 弱 | 低温低压下启动电流不足 |
| 输出 swing 小 | 输出 buffer 设计困难 |
| 噪声相对变大 | $V_{REF}$ 低时同样噪声对应更大比例误差 |

---


## 4. 高精度温度补偿：曲率补偿及代表结构

### 4.1 曲率补偿的必要性与主要方法

#### 为什么一阶补偿不够

一阶 bandgap 只抵消：


$$
\frac{dV_{REF}}{dT}
$$


但 $V_{BE}(T)$ 并不是严格线性。更准确地说，$V_{BE}(T)$ 包含：


$$
T\ln T
$$


以及其他高阶项。

所以：


$$
V_{BE}+K\Delta V_{BE}
$$


只能做到一阶斜率抵消，输出曲线仍然会弯曲。

#### 曲率示意图

![04_curvature_compensation](/GarveyDing_AcademicPages/images/blog/learning-notes/bandgap-reference/04_curvature_compensation.png)

图中第一条曲线表示一阶补偿后残余误差仍然存在；曲率补偿后，输出误差可以在更宽温度范围内减小。

#### 常见曲率补偿方式

#### PTAT² 补偿

生成近似二阶温度项：


$$
I_{PTAT2}\propto T^2
$$


用于抵消 $V_{BE}$ 的二阶曲率。

#### $T\ln T$ 补偿

针对 $V_{BE}$ 模型中的：


$$
T\ln T
$$


项，生成反向补偿。

#### 分段线性补偿

在某些温度区间打开额外补偿电流：


$$
I_{COMP}(T)
$$


例如：

- 高温区增加一支 CTAT 或 PTAT 补偿；
- 低温区增加另一支补偿；
- 中温区关闭补偿。

#### 电阻 TCR 补偿

利用不同电阻的温度系数，使电阻比随温度变化：


$$
\frac{R_2(T)}{R_1(T)}
$$


从而实现高阶补偿。

#### 数字曲率补偿

用数字码控制电阻 DAC 或电流 DAC，实现多点温度校准。

#### 代表结构

| 结构 | 主要特点 |
|---|---|
| Song–Gray | 经典精密曲率补偿 |
| Rincón-Mora–Allen | current-mode + piecewise-linear correction |
| Malcovati | 1 V BiCMOS curvature-compensated BGR |
| Leung 系列 | 低压 CMOS curvature compensation |
| FinFET trimmed BGR | programmable TC / digital trim |

#### 设计代价

曲率补偿虽然能降低温漂，但会引入：

- 更复杂的温度模型；
- 更多补偿支路；
- 更高面积；
- 更复杂的 trim；
- 新的 mismatch 来源；
- 补偿支路噪声；
- 更复杂的 PVT 验证。

因此高精度产品中通常采用“模拟补偿 + trim”的组合，而不是单纯依赖电路天然精度。

---


### 4.2 Rincón-Mora–Allen 分段曲率补偿

#### 定位

Rincón-Mora–Allen 结构是低压 current-mode bandgap 与分段线性曲率补偿的代表。

它的核心思想是：


$$
\text{current-mode BGR}
+
\text{piecewise-linear curvature correction}
$$


#### 基本思想

一阶补偿后，输出在高温或低温端仍然会偏离目标值。因此可以在特定温度区间引入额外电流：


$$
I_{COMP,L}(T)
$$



$$
I_{COMP,H}(T)
$$


分别补偿低温和高温曲率。

#### 优点

- 适合低压；
- 可实现较低温漂；
- current-mode 便于加入补偿电流；
- 可通过电流开关实现分段控制。

#### 缺点

- 温区切换点需要设计；
- 分段补偿支路也有 mismatch；
- 开启/关闭区可能引入斜率不连续；
- 多点 trim 更复杂；
- PVT 下补偿点可能漂移。

#### 学习价值

它非常适合理解：

1. 为什么 current-mode 方便做高阶补偿；
2. 为什么一阶 BGR 不够；
3. piecewise-linear correction 如何工作；
4. 低压 bandgap 如何兼顾温漂。

---


### 4.3 Malcovati / Leung-Mok 等低压曲率补偿

#### Malcovati 型

Malcovati 等工作代表了 1 V 供电下的低压 BiCMOS 曲率补偿 bandgap。

其特点是：

- 低供电；
- sub-bandgap 输出；
- 曲率补偿；
- 适合 BiCMOS 或有较好 BJT 的工艺；
- 温漂可以做到较低。

#### Leung-Mok 型

Leung-Mok 结构强调：

- sub-1-V operation；
- 不需要 low-$V_{TH}$ device；
- 标准 CMOS 兼容；
- 温漂约十几 ppm/°C 量级；
- 适合低压 CMOS 学习。

#### 共同点

这些结构通常具有：


$$
\text{low-voltage}
+
\text{current-mode or modified voltage-mode}
+
\text{curvature correction}
+
\text{careful startup}
$$


#### 主要设计难点

- 运放低压输入输出范围；
- BJT $V_{BE}$ headroom；
- 低压电流镜；
- 高温漏电；
- 电阻 TCR；
- 输出噪声；
- trim 范围；
- PSRR。

---


## 5. 器件与新型实现：寄生 BJT、MOS-only、Resistorless 与 Time-Domain

### 5.1 CMOS 寄生 BJT / Diode-based Bandgap

#### 背景

标准 CMOS 工艺通常没有高性能垂直 NPN，但可以使用：

- vertical PNP；
- lateral PNP；
- substrate PNP；
- Nwell/Psub diode；
- diffusion diode；
- MOS parasitic BJT。

这些器件可以提供 $V_{BE}$ 或 junction voltage，从而构造 BGR。

#### 常见寄生器件

#### Vertical PNP

在 bulk CMOS 中常见，collector 通常接 substrate。

优点：

- 温度特性较接近 BJT；
- 可用于传统 BGR。

缺点：

- $\beta$ 较低；
- collector 连接受限；
- base current error 可能明显。

#### Lateral PNP

可以在平面方向形成 PNP。

优点：

- 连接方式可能更灵活。

缺点：

- 性能和模型依赖工艺；
- 面积大；
- 匹配一般。

#### Diode-connected junction

使用 PN 结正向压降作为 CTAT。

优点：

- 简单；
- 先进工艺中可能更容易获得。

缺点：

- 不一定有完整 BJT 的可控电流密度关系；
- 漏电和寄生效应需要注意。

#### 优点

| 优点 | 说明 |
|---|---|
| 标准 CMOS 兼容 | 不需要额外 BiCMOS |
| 精度较 MOS-only 好 | junction 温度特性更可预测 |
| 可用于主参考 | LDO/ADC/PMIC 中常见 |
| 易与传统理论对应 | 仍然基于 $V_{BE}$、$\Delta V_{BE}$ |

#### 缺点

| 缺点 | 说明 |
|---|---|
| $\beta$ 低 | base current error 大 |
| 模型依赖 PDK | 需要可靠仿真模型 |
| 高温漏电 | junction leakage 影响明显 |
| 面积较大 | 匹配需要大尺寸 |
| 版图约束多 | substrate、well、guard ring 都关键 |

#### 版图注意事项

- BJT 单元共心布局；
- 面积比用单位阵列实现；
- 加 dummy；
- 同方向放置；
- 减小热梯度；
- 周围 guard ring；
- 远离大功率器件和数字时钟；
- 电阻也需共心和 interdigitation；
- 关键节点短且对称；
- 注意 substrate noise。

---


### 5.2 MOS-only / Subthreshold Voltage Reference

#### 定位

MOS-only reference 严格来说不一定是传统 BJT bandgap，而是：


$$
\text{MOSFET-based voltage reference}
$$


或：


$$
\text{bandgap-like reference}
$$


它利用 MOSFET 的温度特性替代 BJT 的 $V_{BE}$ 和 $\Delta V_{BE}$。

#### Subthreshold MOS 原理

弱反型 MOS 电流近似为：


$$
I_D
\propto
\exp\left(\frac{V_{GS}-V_{TH}}{nV_T}\right)
$$


这个形式与 BJT 指数关系类似。因此可以构造类似：


$$
\Delta V_{GS}\propto V_T\ln N
$$


的 PTAT 信号。

#### VTH-based reference

MOS 阈值电压：


$$
V_{TH}(T)
$$


通常具有负温度系数，可以作为 CTAT-like 量。再与 PTAT 或弱反型信号组合，得到温度补偿参考。

#### 2T / pW reference

一些极低功耗参考只用 2 个或少数 MOSFET 工作在弱反型区，功耗可做到 nW 甚至 pW 量级。

#### 优点

| 优点 | 说明 |
|---|---|
| 极低功耗 | 适合 always-on |
| 面积小 | 不需要大 BJT 或大电阻 |
| 低压友好 | 可在 0.5 V 左右工作 |
| 工艺兼容 | 不依赖寄生 BJT |
| 适合 IoT | sensor node、wake-up circuit |

#### 缺点

| 缺点 | 说明 |
|---|---|
| 工艺漂移大 | $V_{TH}$ variation 强 |
| untrimmed 精度较差 | 一般不如 BJT BGR |
| mismatch 明显 | 小尺寸 MOS 随机失配大 |
| 温漂模型复杂 | 高阶项和工艺依赖强 |
| 不适合高精度 ADC 主参考 | 除非后级强校准 |

#### 适用场景

适合：

- IoT；
- biomedical；
- wearable；
- always-on monitor；
- wake-up circuit；
- low-power sensor；
- 辅助 bias；
- digital SoC local monitor。

不适合直接作为：

- 高速高精度 ADC reference；
- 高精度 DAC reference；
- 精密 LDO 主基准。

---


### 5.3 Resistorless / Switched-Capacitor Reference

#### 为什么要去掉电阻

传统 BGR 中：


$$
I_{PTAT}=\frac{\Delta V_{BE}}{R}
$$


如果希望低功耗，例如 nA 级电流，则 $R$ 可能达到 MΩ 级，面积很大。

先进工艺中大电阻的代价更高，因此出现 resistorless BGR。

#### 实现方式

#### MOS pseudo-resistor

用 MOS 工作在线性区、亚阈值区或特殊连接方式形成大电阻。

#### Switched-capacitor resistor

使用：


$$
R_{EQ}=\frac{1}{f_{CLK}C}
$$


由开关电容模拟电阻。

#### 电容比例求和

用电容比代替电阻比，对 PTAT/CTAT 信号进行加权。

#### 动态采样 PN 结电压

在不同时间点采样 PN 结放电电压，通过时间和电荷共享形成温度补偿。

#### 优点

- 面积较小；
- 功耗低；
- 电容匹配较好；
- 适合先进工艺；
- 可数字控制；
- 可 duty-cycle 工作。

#### 缺点

- 需要时钟；
- 有 ripple；
- 有 kT/C 噪声；
- 开关注入和时钟馈通；
- 对时钟频率和 duty cycle 敏感；
- 输出需要滤波；
- 不一定适合低噪声主参考。

---


### 5.4 Time-domain / Digital-like Bandgap

#### 定位

Time-domain 或 digital-like bandgap 是先进工艺中的重要方向。它试图用时间、开关、电容和数字逻辑替代传统的高增益运放、大电阻和精密电流镜。

#### 典型思路

一种典型结构为：


$$
\text{PN junction}
\rightarrow
\text{capacitive bias}
\rightarrow
\text{voltage decay}
\rightarrow
\text{time sampling}
\rightarrow
\text{charge sharing}
\rightarrow
V_{REF}
$$


也可以是：


$$
\text{PTAT delay}+\text{CTAT delay}
\rightarrow
\text{time-domain compensation}
$$


#### Reverse bandgap

所谓 reverse bandgap 通常不是传统静态 $V_{BE}+K\Delta V_{BE}$，而是通过动态方式从 diode decay 或 bulk diode 中抽取 PTAT/CTAT 信息，再合成 sub-bandgap reference。

#### 优点

| 优点 | 说明 |
|---|---|
| 先进工艺友好 | 数字逻辑面积小 |
| 少用运放 | 降低模拟设计压力 |
| 少用精密电阻 | 面积优势明显 |
| 可数字校准 | timing 可编程 |
| 功耗低 | 可 duty-cycle |
| 适合 FinFET | 可用 bulk diode / PN junction |

#### 缺点

| 缺点 | 说明 |
|---|---|
| 需要时钟 | 静态参考变成动态系统 |
| 输出有 ripple | 需滤波 |
| jitter 敏感 | 时间误差会转成电压误差 |
| kT/C 噪声 | 电容采样噪声存在 |
| 开关非理想 | charge injection、feedthrough |
| 难直接驱动 ADC reference | 需要 buffer/LDO |

#### 适用场景

适合：

- advanced FinFET digital SoC；
- low-power monitor；
- local reference；
- temperature sensor；
- 数字辅助 reference；
- 对面积功耗非常敏感的系统。

对于高速 ADC 主参考，通常需要额外 buffer、滤波和隔离。

---


## 6. 先进工艺与系统增强：FinFET、PSRR 与数字校准

### 6.1 先进 FinFET 工艺下的 Bandgap

#### 为什么先进工艺下 Bandgap 变难

进入 32 nm、16 nm、7 nm、4 nm 等 FinFET 后，bandgap 面临：

- 电源电压降低；
- MOS intrinsic gain 降低；
- 电阻面积昂贵；
- 模拟 headroom 紧张；
- BJT/diode 器件受限；
- Fin 数量量化；
- 版图规则复杂；
- 随机失配和局部 variation 强；
- 数字噪声更强。

#### 先进工艺主流路线

#### 路线一：寄生 BJT + current-mode sub-bandgap

高精度主参考仍倾向于使用 parasitic BJT 或 PN junction，因为它们的温度特性比 MOS-only 更可预测。

常见组合是：


$$
\text{Parasitic BJT}
+
\text{current-mode}
+
\text{digital trim}
+
\text{curvature compensation}
$$


#### 路线二：PN diode / bulk diode reference

当完整 BJT 不好用时，可以使用 diode junction。

#### 路线三：time-domain reverse bandgap

利用时钟、电容和 diode decay 形成 reference。

#### 路线四：MOS-only local reference

用于局部 monitor 和低精度 always-on block。

#### 先进工艺中的典型特点

| 目标 | 常见选择 |
|---|---|
| 高精度 | parasitic BJT + trim |
| 低功耗 | MOS-only / time-domain |
| 小面积 | resistorless / ultra-compact |
| 低压 | current-mode / sub-bandgap |
| 高 yield | digital trim / calibration |
| 多输出 | fractional / multi-output BGR |

#### 对 28 nm CMOS 的启发

对于 28 nm，尤其是高速 ADC 方向，最实际的选择通常不是最前沿的 digital reverse bandgap，而是：

1. 若有 1.8 V analog supply：  
   使用寄生 BJT Brokaw/Kuijk 型，后接 buffer/LDO。

2. 若只有 1.0 V core supply：  
   使用 Banba-like current-mode sub-bandgap。

3. 若只是 always-on 低精度 bias：  
   可考虑 MOS-only / subthreshold reference。

4. 若给高速 ADC CDAC 供参考：  
   bandgap 后面必须接 reference buffer / LDO / decap network。

---


### 6.2 高 PSRR Bandgap

#### 为什么 PSRR 重要

Bandgap 输出不仅要温度稳定，还要不受电源噪声影响。电源噪声可能来自：

- 数字开关；
- DC-DC ripple；
- LDO 输入扰动；
- clock driver；
- IO switching；
- substrate coupling。

对于 ADC，reference 上的电源相关噪声可能变成：

- 增益调制；
- spur；
- harmonic distortion；
- noise floor 上升。

#### 常见高 PSRR 技术

#### Pre-regulator

在 bandgap core 前增加预稳压：


$$
V_{DD}\rightarrow V_{REG}\rightarrow BGR
$$


#### Cascode / regulated cascode current mirror

提高电流镜输出阻抗，降低电源变化对电流的影响。

#### Supply-independent bias

构造对电源变化不敏感的偏置电流。

#### Output filtering

使用：

- RC filter；
- active filter；
- large capacitor；
- low-noise buffer。

#### Chopping / auto-zero

降低低频 offset 和 $1/f$ noise，但会引入 chopping ripple，需要滤波。

#### Differential / ratiometric structure

让电源噪声成为共模，再通过差分或比例结构抵消。

#### PSRR 分频段理解

| 频段 | 主要限制 |
|---|---|
| 低频 | loop gain、电流镜 $r_o$、运放 PSRR |
| 中频 | 环路带宽、补偿极点 |
| 高频 | 寄生电容直通 |
| 开关频点 | 时钟、DC-DC、数字 spur |
| 极高频 | 版图耦合和封装寄生 |

---


### 6.3 Digitally Trimmed / Calibration-Assisted Bandgap

#### 为什么需要 trim

Bandgap 的理论温漂可以很低，但实际芯片存在：

- BJT mismatch；
- 电阻 mismatch；
- 运放 offset；
- 电流镜 mismatch；
- 电阻 TCR variation；
- 封装应力；
- 工艺角变化。

因此高精度产品通常必须 trim。

#### 常见 trim 对象

| Trim 对象 | 目的 |
|---|---|
| 输出电阻比 | 修正室温输出 |
| PTAT 电阻比 | 修正一阶温度系数 |
| 电流镜比例 | 修正 CTAT/PTAT 权重 |
| BJT 电流密度比 | 修正 $\Delta V_{BE}$ |
| 运放 offset | 减少节点误差 |
| 曲率补偿支路 | 修正二阶/高阶温漂 |
| reference DAC | 数字校准输出 |

#### 单点、两点、多点 trim

#### 单点 trim

只在一个温度点，例如 25 °C，修正输出值。

优点：

- 测试成本低；
- 实现简单。

缺点：

- 不能保证温漂。

#### 两点 trim

在两个温度点修正斜率。

优点：

- 可以修正一阶 TC；
- 性价比较高。

缺点：

- 不能完全修正曲率。

#### 多点 trim

在多个温度点拟合和校正输出曲线。

优点：

- 精度最高；
- 可修正曲率。

缺点：

- 测试成本高；
- 数字逻辑复杂；
- 产测时间增加。

#### 先进 SoC 中的数字辅助

现代 SoC 常用：

- eFuse；
- OTP；
- digital register trim；
- current DAC；
- resistor DAC；
- thermometer-coded trim；
- background calibration；
- temperature sensor assisted correction；
- LUT compensation。

---


## 7. Bandgap 在 ADC Reference System 中的角色

### 7.1 Bandgap + Reference Buffer / LDO 系统结构

> 相关专题：[ADC Reference Voltage Buffer（RVB）：架构与设计](/GarveyDing_AcademicPages/blog/adc-reference-buffer/)

#### 为什么 Bandgap 不能直接驱动 ADC

对于 SAR ADC / pipeline-SAR ADC，reference 端不是静态负载，而是强动态负载。

CDAC 切换会产生瞬态电荷需求：


$$
Q=C\Delta V
$$


如果 bandgap core 直接驱动 CDAC，会出现：

- reference droop；
- reference ringing；
- incomplete settling；
- input-dependent reference error；
- harmonic distortion；
- SFDR 下降；
- SNDR 下降；
- 通道间耦合；
- spur。

因此，ADC reference 系统通常是系统级设计，而不是一个简单 BGR。

#### 典型 ADC reference 系统

![05_adc_reference_system](/GarveyDing_AcademicPages/images/blog/learning-notes/bandgap-reference/05_adc_reference_system.png)

#### 各模块职责

| 模块 | 主要职责 |
|---|---|
| Bandgap core | 长期 PVT 稳定性 |
| Trim / calibration | 修正初始误差和温漂 |
| Reference LDO | 隔离电源，降低输出阻抗 |
| Reference buffer | 驱动动态负载 |
| Decap network | 提供瞬态电荷 |
| ADC CDAC | 动态切换负载 |

#### Bandgap 与 Reference Buffer 的区别

Bandgap 关注：

- 温漂；
- 初始精度；
- line sensitivity；
- 低频噪声；
- PVT 稳定；
- long-term drift。

Reference buffer 关注：

- 输出阻抗；
- dynamic settling；
- load transient；
- large-signal recovery；
- phase margin；
- reference kickback；
- distortion；
- 高频 PSRR。

因此：


$$
\boxed{
\text{Bandgap 决定参考的低频准确性；Reference Buffer 决定高速动态准确性}
}
$$


#### 对高速 ADC 的建议

对于高速 pipeline-SAR / SAR ADC：

1. 不建议 bandgap 直接驱动 CDAC；
2. reference buffer 输出阻抗必须足够低；
3. decap 要靠近 CDAC；
4. VREFP / VREFN / VCM 需要同时考虑；
5. reference routing 要对称；
6. reference buffer 的非线性会影响 SFDR；
7. reference noise 会影响 SNDR；
8. reference settling error 会形成输入相关失真；
9. reference LDO / buffer 的稳定性要带实际 decap 验证。

---


### 7.2 不同应用场景下的结构选择

#### 高精度 LDO / PMIC

推荐结构：


$$
\text{Brokaw / Kuijk BGR}
+
\text{curvature compensation}
+
\text{trim}
$$


原因：

- 供电一般较高；
- 对温漂和初始精度要求高；
- 工业成熟；
- 可接受一定面积和功耗。

#### 低压 SoC

推荐结构：


$$
\text{Banba-like current-mode sub-bandgap}
$$


或：


$$
\text{low-voltage CMOS BGR}
$$


原因：

- 输出可低于 1.2 V；
- 适合 1 V 左右电源；
- 可与 digital trim 配合。

#### 先进 FinFET 高精度主参考

推荐结构：


$$
\text{Parasitic BJT}
+
\text{current-mode}
+
\text{digital trim}
+
\text{curvature compensation}
$$


原因：

- BJT/PN junction 温度特性仍有优势；
- digital trim 可弥补先进工艺 variation；
- 适合 SoC 主参考。

#### IoT / Always-on 超低功耗

推荐结构：


$$
\text{MOS-only}
$$


或：


$$
\text{subthreshold / VTH-based reference}
$$


原因：

- 功耗极低；
- 面积小；
- 低压可用。

但一般不适合作为高精度 ADC 主参考。

#### 高速 ADC

推荐系统：


$$
\text{BJT BGR or sub-bandgap}
+
\text{low-noise LDO / buffer}
+
\text{large decap}
+
\text{layout symmetry}
$$


重点不是单独 BGR 的温漂，而是 reference system 的：

- dynamic settling；
- noise；
- PSRR；
- output impedance；
- CDAC kickback recovery；
- distortion。

#### 温度传感器

推荐结构：


$$
\text{PTAT current / voltage}
+
\text{CTAT reference}
+
\text{ADC or comparator}
$$


Bandgap core 可以同时提供：

- $V_{BE}$；
- $\Delta V_{BE}$；
- PTAT current；
- temperature-independent reference。

---


### 7.3 主要结构对比

| 大类 | 代表结构 | 核心思想 | 输出范围 | 优点 | 缺点 | 典型应用 |
|---|---|---|---|---|---|---|
| 经典电压模 | Widlar / Kuijk | $V_{BE}+K\Delta V_{BE}$ | 约 1.2 V | 原理清楚 | 低压困难 | 教学、传统 BGR |
| Brokaw cell | Brokaw | two-transistor cell | 约 1.2 V | 高精度、工业成熟 | headroom 较高 | LDO、PMIC、ADC |
| 电流模 | Banba | CTAT/PTAT 电流相加 | 可缩放 | 低压友好 | 电流镜敏感 | 低压 CMOS |
| Sub-bandgap | Banba-like / fractional | 低于 1.2 V 输出 | 0.2–0.8 V | 适合低压 SoC | 噪声占比变大 | SoC reference |
| 曲率补偿 | Song–Gray | 高阶温漂补偿 | 取决于架构 | TC 可很低 | 电路复杂 | 精密基准 |
| 分段补偿 | Rincón-Mora–Allen | 分温区补偿 | 低压 | 曲率改善 | 需温区设计 | 低压高精度 |
| 低压 CMOS | Leung–Mok | 标准 CMOS sub-1-V | <1 V | 不依赖特殊器件 | headroom 紧张 | 低压芯片 |
| 寄生 BJT CMOS | vertical/lateral PNP | 标准 CMOS 中用寄生 BJT | 1.2 V 或低压 | 精度较好 | $\beta$ 低、模型关键 | PMIC、ADC |
| MOS-only | subthreshold / VTH | MOS 温度特性 | 低压 | 超低功耗 | 精度较差 | IoT、always-on |
| Resistorless | SC / pseudo-R | 去掉大电阻 | 低压 | 面积小 | 有 ripple/noise | 低功耗 reference |
| Time-domain | digital reverse BGR | 时间采样 + 电荷共享 | 低压 | 先进工艺友好 | jitter/ripple 敏感 | FinFET SoC |
| FinFET BGR | 7 nm / 4 nm BJT BGR | 寄生 BJT + trim | 低压或 1 V | 可高精度 | 设计复杂 | 先进 SoC |
| 高 PSRR | pre-regulated BGR | 隔离电源噪声 | 任意 | 抗干扰强 | 功耗面积增加 | ADC/RF/PMIC |
| 数字辅助 | trimmed BGR | fuse/DAC/LUT 校准 | 任意 | yield 高 | 测试成本高 | 高精度 SoC |
| ADC reference 系统 | BGR + LDO + buffer | 分离 DC 精度与动态驱动 | VREFP/N | 适合高速 ADC | 系统复杂 | SAR/pipeline ADC |

---


## 8. 学习路线、参考文献与工程附录

### 8.1 推荐学习路线

#### 第一阶段：基本物理原理

重点掌握：

1. BJT 指数关系；
2. $V_{BE}$ 的 CTAT 特性；
3. $\Delta V_{BE}$ 的 PTAT 特性；
4. 一阶温度补偿；
5. 传统输出约 1.2 V 的原因。

建议先推导：


$$
\Delta V_{BE}=V_T\ln N
$$


再推导：


$$
V_{REF}=V_{BE}+K\Delta V_{BE}
$$


#### 第二阶段：经典电压模架构

阅读顺序：

1. Widlar；
2. Kuijk；
3. Brokaw。

重点是 Brokaw cell。

需要掌握：

- 两 BJT 电流密度比；
- PTAT 电流生成；
- 电阻比设定；
- startup；
- base current error；
- loop stability；
- PSRR。

#### 第三阶段：低压电流模架构

阅读顺序：

1. Rincón-Mora–Allen；
2. Banba；
3. Malcovati；
4. Leung–Mok。

重点是 Banba 型。

需要掌握：


$$
V_{REF}
=
R_O
\left(
\frac{V_{BE}}{R_C}
+
\frac{\Delta V_{BE}}{R_P}
\right)
$$


以及为什么输出可以低于 1.2 V。

#### 第四阶段：曲率补偿

重点理解：

- 一阶补偿为什么不够；
- $T\ln T$ 项；
- PTAT² 补偿；
- 分段线性补偿；
- 电阻 TCR 补偿；
- 多点 trim。

#### 第五阶段：先进工艺

重点看：

- 32 nm FinFET sub-1-V BGR；
- 16 nm FinFET digital reverse bandgap；
- 7 nm FinFET BJT BGR；
- 4 nm FinFET PNP BJT BGR；
- MOSFET-based voltage reference review。

#### 第六阶段：系统应用

对于 ADC，重点不是单独 bandgap core，而是：


$$
\boxed{
\text{Bandgap}
+
\text{Reference Buffer}
+
\text{Decap}
+
\text{Calibration}
}
$$


需要把 reference 看成一个完整动态系统。

---


### 8.2 核心参考文献

#### 经典 Bandgap

1. D. F. Hilbiber, “A New Semiconductor Voltage Standard,” *ISSCC Digest of Technical Papers*, 1964.

2. R. J. Widlar, “New Developments in IC Voltage Regulators,” *IEEE Journal of Solid-State Circuits*, vol. 6, no. 1, pp. 2–7, 1971.

3. K. E. Kuijk, “A Precision Reference Voltage Source,” *IEEE Journal of Solid-State Circuits*, vol. 8, no. 3, pp. 222–226, 1973.

4. A. P. Brokaw, “A Simple Three-Terminal IC Bandgap Reference,” *IEEE Journal of Solid-State Circuits*, vol. SC-9, no. 6, pp. 388–393, 1974.

5. B. Razavi, “The Bandgap Reference,” *IEEE Solid-State Circuits Magazine*, 2016.

#### 曲率补偿与低压 Bandgap

6. B.-S. Song and P. R. Gray, “A Precision Curvature-Compensated CMOS Bandgap Reference,” *IEEE Journal of Solid-State Circuits*, vol. 18, no. 6, pp. 634–643, 1983.

7. G. A. Rincón-Mora and P. E. Allen, “A 1.1-V Current-Mode and Piecewise-Linear Curvature-Corrected Bandgap Reference,” *IEEE Journal of Solid-State Circuits*, vol. 33, no. 10, pp. 1551–1554, 1998.

8. H. Banba et al., “A CMOS Bandgap Reference Circuit With Sub-1-V Operation,” *IEEE Journal of Solid-State Circuits*, vol. 34, no. 5, pp. 670–674, 1999.

9. P. Malcovati, F. Maloberti, C. Fiocchi, and M. Pruzzi, “Curvature-Compensated BiCMOS Bandgap With 1-V Supply Voltage,” *IEEE Journal of Solid-State Circuits*, vol. 36, no. 7, pp. 1076–1081, 2001.

10. K. N. Leung and P. K. T. Mok, “A Sub-1-V 15-ppm/°C CMOS Bandgap Voltage Reference Without Requiring Low Threshold Voltage Device,” *IEEE Journal of Solid-State Circuits*, 2002.

11. M.-D. Ker and J.-S. Chen, “New Curvature-Compensation Technique for CMOS Bandgap Reference With Sub-1-V Operation,” *IEEE Transactions on Circuits and Systems II*, 2006.

#### MOS-only / 超低功耗 Reference

12. K. Ueno et al., “A 300 nW, 15 ppm/°C, 20 ppm/V CMOS Voltage Reference Circuit Consisting of Subthreshold MOSFETs,” *IEEE Journal of Solid-State Circuits*, 2009.

13. L. Magnelli et al., “A 2.6 nW, 0.45 V Temperature-Compensated Subthreshold CMOS Voltage Reference,” *IEEE Journal of Solid-State Circuits*, 2011.

14. M. Seok, G. Kim, D. Blaauw, and D. Sylvester, “A Portable 2-Transistor Picowatt Temperature-Compensated Voltage Reference Operating at 0.5 V,” *IEEE Journal of Solid-State Circuits*, 2012.

15. I. Lee, D. Sylvester, and D. Blaauw, “A Subthreshold Voltage Reference With Scalable Output Voltage for Low-Power IoT Systems,” *IEEE Journal of Solid-State Circuits*, 2017.

#### 先进工艺 / FinFET

16. A. J. Annema, P. Veldhorst, G. Doornbos, and B. Nauta, “A Sub-1-V Bandgap Voltage Reference in 32-nm FinFET Technology,” *ISSCC Digest of Technical Papers*, 2009.

17. C.-H. Chang et al., “An Ultra-Compact, Untrimmed CMOS Bandgap Reference With 3σ Inaccuracy of +0.64% in 16 nm FinFET,” *A-SSCC*, 2014.

18. M. Eberlein, G. Panagopoulos, and H. Pretl, “A 40 nW, Sub-1 V Truly ‘Digital’ Reverse Bandgap Reference Using Bulk-Diodes in 16 nm FinFET,” *A-SSCC*, 2018.

19. U. Kamath et al., “A 1-V Bandgap Reference in 7-nm FinFET With a Programmable Temperature Coefficient and Inaccuracy of ±0.2% From −45 °C to 125 °C,” *IEEE Journal of Solid-State Circuits*, 2019.

20. Y. Li et al., “Compact PNP BJT-Based Temperature Sensor and Sub-1-V Bandgap Reference for SoC Applications in 4-nm FinFET,” *IEEE Journal of Solid-State Circuits*, 2025.

21. E. Moisello, E. Bonizzoni, and P. Malcovati, “MOSFET-Based Voltage Reference Circuits in the Last Decade: A Review,” *Micromachines*, 2024.

---


### 8.3 最终总结

Bandgap 的结构发展可以用一句话概括：


$$
\boxed{
\text{从电压模 1.2 V 精密基准}
\rightarrow
\text{低压电流模 sub-bandgap}
\rightarrow
\text{曲率补偿与数字 trim}
\rightarrow
\text{先进工艺 MOS-only / time-domain / FinFET BJT reference}
}
$$


最核心的三条主线是：

1. **Brokaw 型精密电压模**  
   适合高精度、较高供电、电源管理和 ADC/DAC 前级。

2. **Banba 型低压电流模**  
   适合低压 CMOS 和 sub-1-V 系统，是现代低压 BGR 的关键思想。

3. **Bandgap + Reference Buffer 系统结构**  
   对高速 ADC 最关键，bandgap 本身只负责低频稳定性，真正决定动态精度的是 buffer/LDO/decap/reference routing。

对于 ADC 方向，建议优先掌握：


$$
\boxed{
\text{Brokaw}
+
\text{Banba}
+
\text{Curvature Compensation}
+
\text{Reference Buffer System}
}
$$


这四部分基本覆盖了从基础 bandgap 到高速 ADC reference system 的主线。

---


## 9. 工程附录

### 9.1 附录 A：Bandgap 发展历程


1964 年，D. F. Hilbiber 在 ISSCC 发表 “A New Semiconductor Voltage Standard”，提出利用半导体结电压及其温度特性构成电压基准的早期思想。

随后 Widlar 将相关思想引入集成稳压器和基准电路。

1971 年，R. J. Widlar 发表 “New Developments in IC Voltage Regulators”，给出了被广泛视为早期 bandgap reference 原型的电路。其核心思想已经是：


$$
V_{BE}+K\Delta V_{BE}
$$




#### A.2 1970 年代：经典电压模 Bandgap 成型

1973 年，K. E. Kuijk 提出 “A Precision Reference Voltage Source”。Kuijk 结构采用反馈放大器建立两个 BJT 的电流密度差，通过电阻产生并放大 $\Delta V_{BE}$。

1974 年，Paul Brokaw 提出著名的 **Brokaw cell**。该结构通过两个 BJT、反馈放大器和电阻网络生成稳定参考，并系统考虑了基极电流误差、频率补偿、启动和电源抑制等问题。

这一时期形成了传统电压模 bandgap 的基本范式：


$$
V_{REF}=V_{BE}+K\Delta V_{BE}
$$




#### A.3 1970 年代末至 1980 年代：CMOS Bandgap 与曲率补偿

随着 CMOS 工艺发展，研究重点转向如何在标准 CMOS 中利用寄生 vertical PNP、lateral PNP 或其他结器件实现 bandgap。

1978—1979 年前后，Tsividis、Vittoz、Blauschild 等研究者发表了早期 CMOS voltage reference 和 low-voltage CMOS bandgap 工作。

1983 年，Song 和 Gray 提出经典的曲率补偿 CMOS bandgap。该结构采用开关电容技术改善 $V_{BE}$(T) 的非线性，成为高精度 curvature-compensated BGR 的代表工作。

#### A.4 1990 年代：低压与分段曲率补偿

随着供电电压下降，传统约 1.2 V 输出的 bandgap 开始受到限制。

1998 年，Rincón-Mora 和 Allen 提出：

> A 1.1-V Current-Mode and Piecewise-Linear Curvature-Corrected Bandgap Reference

该结构使用电流模求和和分段线性曲率补偿，属于低压、高精度 current-mode bandgap 的代表。

1999 年，Banba 等人提出经典的 sub-1-V CMOS bandgap，将 $V_{BE}$ 和 $\Delta V_{BE}$ 分别转换成 CTAT、PTAT 电流，再在电流域相加，因此输出不再必须接近 1.2 V。

#### A.5 2000 年代：Sub-1-V 与高阶曲率补偿成熟

2001 年，Malcovati 等人提出工作于 1 V 供电的曲率补偿 BiCMOS bandgap，可产生约 0.53 V 的参考电压。

2002 年，Leung 和 Mok 提出不依赖低阈值器件的 sub-1-V CMOS bandgap，报告了约 15 ppm/°C 的温度系数，成为标准 CMOS 低压 BGR 的经典论文。

这一阶段的主要发展包括：

- current-mode bandgap；

- sub-bandgap 输出；

- sub-1-V 供电；

- 二阶和高阶曲率补偿；

- 分段线性补偿；

- 电阻、电流和数字 trimming。


#### A.6 2010 年代以后：超低功耗、MOS-only 与先进 FinFET

2009 年，Annema 等人在 32 nm SOI FinFET 中实现 sub-1-V bandgap，针对先进工艺中电阻面积和结器件可用性进行了架构优化。

2012 年，Seok 等提出两晶体管、皮瓦级温度补偿 voltage reference。这类电路严格说并非传统 BJT bandgap，而属于 MOS-only 或 $V_{TH}$-based voltage reference。

2018 年，Eberlein 等在 16 nm FinFET 中提出基于 bulk diode 和时间采样的“数字式 reverse bandgap”，通过电容放电、时序控制和电荷共享形成 PTAT/CTAT 补偿。

2019 年，Kamath 等在 7 nm FinFET 中实现可编程温度系数的 BJT-based bandgap，说明先进 FinFET 中仍然可以通过寄生 BJT、器件—电路协同优化和 trimming 实现高精度 bandgap。

2025 年，Li 等在 4 nm FinFET 中实现了紧凑型 PNP BJT 温度传感器和 sub-1-V bandgap，进一步表明寄生 BJT 架构在先进节点中仍具有实用价值。

---

---


### 9.2 附录 B：Song–Gray 曲率补偿结构


Song–Gray 结构重点不在基础 PTAT/CTAT 生成，而在 **曲率补偿**。

其目标是抵消 $V_{BE}$(T) 中的高阶项，例如：


$$
T\ln T
$$




等非线性温度分量。该工作使用 switched-capacitor 技术实现精密曲率补偿，是高阶 bandgap 补偿的重要早期代表。

---


### 9.3 附录 C：可流片 Bandgap 的完整电路组成


一个可流片的 bandgap 通常不只是 PTAT/CTAT 核心，而是包含以下模块。

#### C.1 Bandgap core

负责生成：

- $V_{BE}$；

- $\Delta V_{BE}$；

- PTAT 电流；

- CTAT 电流；

- 最终零温度系数参考。


#### C.2 误差放大器

误差放大器强制两个关键节点电压相等。

其主要指标包括：

- 输入共模范围；

- DC 增益；

- offset；

- offset drift；

- 输入噪声；

- PSRR；

- 输出摆幅；

- 环路稳定性；

- 启动阶段的大信号恢复能力。


运放 offset 会直接改变两个 BJT 的电流密度比，进而影响：


$$
\Delta V_{BE}
$$




所以高精度 bandgap 中，运放 offset 往往是核心误差源之一。

#### C.3 Startup 电路

自偏置 bandgap 通常存在一个零电流解：


$$
I=0
$$




这个状态可能满足部分环路方程，因此仅靠电源上电不一定能自动进入正常工作点。

Startup 电路需要：

1. 上电时向核心注入电流；

2. 将工作点推离零电流状态；

3. 正常启动后退出；

4. 退出后不能继续影响温漂、PSRR 和静态功耗。


Startup 需要在以下条件下验证：

- 慢上电；

- 快上电；

- 低温；

- 高温；

- SS/FF corner；

- 电源跌落后重新上电；

- 输出节点存在预充电；

- 负载电容很大。


#### C.4 Trimming 与校准

常见 trim 对象包括：

|Trim 对象|主要修正内容|
|---|---|
|PTAT 电阻比|一阶温度系数|
|输出电阻比|室温初始输出误差|
|BJT 电流比|电流密度误差|
|运放 offset|核心节点电压误差|
|曲率补偿电流|二阶和高阶温漂|
|数字 DAC|多温点数字校准|

#### 单点 trim

通常在室温修正输出电压。优点是测试成本低，但不能独立修正斜率和曲率。

#### 两点 trim

在两个温度点测量，可分别估计：

- offset；

- 一阶温度斜率。


#### 多点 trim

可以修正高阶曲率，但测试成本和数字逻辑开销更高。

#### C.5 输出缓冲器

Bandgap core 往往只能驱动很轻的静态负载。

尤其在 SAR ADC 中，CDAC 切换会对参考端产生脉冲式充放电电流。若直接由 bandgap 驱动，会产生：

- reference droop；

- reference bounce；

- settling 误差；

- 输入相关失真；

- 通道间耦合；

- SFDR 和 SNDR 下降。


因此高速 ADC 中通常采用：


$$
\text{Bandgap} \rightarrow \text{低噪声缓冲器或 LDO} \rightarrow \text{大去耦电容} \rightarrow \text{CDAC}
$$




Bandgap 负责长期稳定性，reference buffer 负责动态驱动能力。

---


### 9.4 附录 D：Bandgap 的主要误差来源


|误差来源|对输出的影响|常见改进方式|
|---|---|---|
|BJT $V_{BE}$ mismatch|初始输出偏差|增大面积、共心布局、trim|
|BJT 面积比误差|$\Delta V_{BE}$ 偏差|单位阵列、dummy、对称布局|
|电阻比 mismatch|PTAT 权重误差|大面积电阻、共心、分段 trim|
|电阻 TCR mismatch|温漂变差|同类型电阻、TCR 补偿|
|运放 offset|节点不相等、TC 和初值误差|chopping、auto-zero、trim|
|运放有限增益|支路电流比误差|提高 DC gain、局部增益增强|
|电流镜 mismatch|CTAT/PTAT 权重误差|增大面积、级联、动态匹配|
|电流镜 $r_o$ 有限|Line regulation、PSRR 下降|cascode、regulated cascode|
|BJT 基极电流|电阻电流误差|高 $\beta$ BJT、基极电流补偿|
|封装应力|$V_{BE}$、电阻和 mismatch 漂移|对称布局、应力隔离|
|热梯度|PTAT 比例和匹配误差|靠近布局、共心、热对称|
|漏电流|高温下输出漂移|降低高阻节点、保护结结构|
|startup 残余电流|增加功耗、破坏温漂|正常工作后彻底关断|

---


### 9.5 附录 E：Bandgap 的主要性能指标


常见定义为：


$$
TC= \frac{V_{MAX}-V_{MIN}} {V_{NOM}(T_{MAX}-T_{MIN})} \times10^6 \quad\text{ppm}/^\circ\text{C}
$$




需要注意，TC 数值会明显依赖测试温度范围。

例如：

- 0–70 °C；

- −40–85 °C；

- −40–125 °C；

- −55–150 °C。


不同温度范围的 TC 不能直接横向比较。

#### E.2 初始精度

初始精度通常写成：


$$
\text{Accuracy} = \frac{V_{REF}-V_{TARGET}} {V_{TARGET}} \times100\%
$$




应区分：

- typical；

- mean；

- 1$\sigma$；

- 3$\sigma$；

- worst case；

- trimmed；

- untrimmed。


#### E.3 Line sensitivity

表示电源电压变化对输出的低频影响：


$$
LS= \frac{\Delta V_{REF}} {\Delta V_{DD}}
$$




常用单位包括：

- mV/V；

- %/V；

- ppm/V。


#### E.4 PSRR

PSRR 表示交流电源扰动到输出的耦合：


$$
PSRR(f) = 20\log_{10} \left| \frac{\Delta V_{DD}(f)} {\Delta V_{REF}(f)} \right|
$$




Bandgap 的低频 PSRR 与环路增益、电流镜输出阻抗有关；高频 PSRR 更多受寄生电容、输出阻抗和电源直通路径限制。

#### E.5 输出噪声

Bandgap 噪声主要来自：

- 运放输入对管的热噪声和 1/f 噪声；

- 电阻热噪声；

- BJT shot noise；

- 电流镜噪声；

- chopping ripple；

- 输出缓冲器噪声。


对于 ADC，应关注的是积分到 ADC 有效带宽内的 reference noise，而不只是某个频点的噪声谱密度。

#### E.6 其他重要指标

还应关注：

- 最低工作电压；

- 功耗和静态电流；

- startup time；

- 输出电流能力；

- 输出阻抗；

- 负载调整率；

- 面积；

- trim bit 数；

- 温度循环和长期漂移；

- 封装后的应力敏感性；

- PVT yield。


---

---


### 9.6 附录 F：面向 28 nm 高速 ADC 的架构建议


结合 28 nm、约 1 V 核心供电和高速 ADC 应用，推荐优先评估以下两种方案。

#### F.1 存在 1.8 V 模拟或 I/O 电源域

可以采用：


$$
\text{寄生 BJT Brokaw/Kuijk BGR}
$$




产生约 1.2 V 基准，再通过：

- 低噪声 LDO；

- reference buffer；

- 电阻或电流比例转换；


生成 ADC 所需的：


$$
V_{REFP},\quad V_{REFN},\quad V_{CM}
$$




优点是 bandgap core 有充足 headroom，放大器、电流镜和 startup 更容易设计。

#### F.2 只能使用 1.0 V 核心电源

更适合采用：


$$
\text{Banba-like current-mode sub-bandgap}
$$




输出可设计在：


$$
0.4\sim0.6\ \text{V}
$$




再通过低噪声 buffer 产生 ADC 所需的参考端电压。

需要重点验证：

- 寄生 PNP 的模型和匹配；

- 运放输入共模范围；

- PMOS/NMOS 电流镜 headroom；

- 高温漏电；

- SS、低压、低温启动；

- 电阻 TCR；

- 输出噪声和 PSRR；

- Monte Carlo 下的温漂分布。


对于高速 SAR 或 pipeline-SAR ADC，工程上应将 **bandgap 精度问题** 和 **reference 动态驱动问题** 分开处理：


$$
\boxed{ \text{Bandgap 决定低频基准稳定性，Reference Buffer 决定高速动态建立精度} }
$$




---


## 相关笔记

- [ADC Reference Voltage Buffer（RVB）：架构与设计](/GarveyDing_AcademicPages/blog/adc-reference-buffer/)
- [电路噪声：从 MOS 器件到系统设计](/GarveyDing_AcademicPages/blog/circuit-noise/)
- [PVT 对 MOS 管性能参数的影响](/GarveyDing_AcademicPages/blog/mos-pvt/)
- [TSMC 28 nm CMOS 片上无源器件：电阻、电容与电感](/GarveyDing_AcademicPages/blog/cmos28-passive-devices/)
