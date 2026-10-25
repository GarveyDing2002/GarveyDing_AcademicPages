---
title: ADC Reference Voltage Buffer（RVB）：架构与设计
date: 2026-08-19
excerpt: 面向高速和高精度 ADC，分析 RVB 在开关电容脉冲负载下的架构、动态指标与设计方法。
tags:
  - 学习记录
  - adc
  - rvb
  - reference-buffer
---

> **核心定位**
> 面向高速和高精度 ADC，分析 RVB 在开关电容脉冲负载下的架构、动态指标与设计方法。

---

> **适用范围**：本文主要讨论高速/高精度 SAR ADC、pipeline-SAR ADC、TI-ADC 中用于驱动 CDAC 的 Reference Voltage Buffer（RVB）。  
> **核心观点**：RVB 的本质不是“把一个电压复制出来”，而是在 CDAC 周期性、强脉冲、双向电荷交换的负载下，使参考节点在决策窗口内保持足够准确、足够低阻抗并快速恢复。

---


> **层次化结构**
> 本版将原来 0～31 的并列章节重构为 **9 个主章节 → 主题小节 → 具体架构/指标/验证方法**。技术内容保持不变，只调整阅读层级。

## 目录

1. RVB 的系统定位与负载本质
   - 1.1 一句话建立整体概念
   - 1.2 为什么 ADC 需要专门的 RVB
   - 1.3 Switched-Capacitor 负载与 Reference Error
   - 1.4 三种时间尺度：CDEC、Local Loop 与 Global Loop
2. RVB 的核心指标与统一分析方法
   - 2.1 DC Accuracy、Zout、Settling、SR 与 Source/Sink
   - 2.2 统一的 RVB 架构分析框架
3. 基础输出级：SF、SSF 与闭环 Opamp Buffer
   - 3.1 架构总览
   - 3.2 Source Follower（SF）
   - 3.3 Super Source Follower（SSF）/ Regulated Follower
   - 3.4 Opamp + Output Stage 闭环型 RVB
4. 双向大电流输出：Push-Pull 与 Class-AB
   - 4.1 Push-Pull 输出级
   - 4.2 Class-AB RVB
5. FVF 家族：从 FVF 到 Super-FVF 与 Class-AB FVF
   - 5.1 Flipped Voltage Follower（FVF）
   - 5.2 Super-FVF / Gain-Boosted FVF
   - 5.3 Class-AB FVF
   - 5.4 SF、SSF、FVF 的统一理解
6. Reference Regulator、CDEC 与动态补能
   - 6.1 LDO-like / Reference Regulator
   - 6.2 Active RVB + Large Decoupling Capacitor
   - 6.3 Capacitor-less / Small-C RVB
   - 6.4 Dynamic / Charge-Replenishment RVB
7. 多通道与 TI-ADC：Hierarchical、Replica 与 Per-Channel RVB
   - 7.1 Global + Local / Hierarchical RVB
   - 7.2 Replica / Mirrored / Per-Channel FVF
8. 架构比较、设计建议与仿真验证
   - 8.1 架构总对比
   - 8.2 五条架构演进主线
   - 8.3 面向 12-bit、几百 MS/s～GS/s pipeline-SAR 的建议
   - 8.4 仿真方法
   - 8.5 常见误区
9. 论文阅读框架、心智模型与学习路线
   - 9.1 阅读一篇 RVB 论文时建议记录的参数
   - 9.2 最终心智模型
   - 9.3 推荐学习顺序
   - 9.4 代表性文献与进一步阅读
   - 9.5 结论

## 1. RVB 的系统定位与负载本质

### 1.1 一句话建立整体概念

可以把 ADC 的供电与基准链路分成三类角色：

- **[Bandgap / Reference Core](/GarveyDing_AcademicPages/blog/bandgap-reference/)：负责“准”**——生成温漂小、长期稳定的基准。
- **LDO：负责“供电稳”**——生成干净的 AVDD/DVDD。
- **RVB：负责“把准确的 reference 变硬”**——在 CDAC 瞬态抽取/回灌电荷时仍维持 VREFP/VREFN。

![01_reference_system_overview](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-reference-buffer/01_reference_system_overview.png)

因此，RVB 与 LDO 在电路拓扑上可能非常相似：二者都可能含误差放大器、功率/输出晶体管、局部反馈、Class-AB、FVF、补偿与输出电容；但**设计对象不同**：


$$
\text{LDO}\rightarrow V_{DD}
$$



$$
\text{RVB}\rightarrow V_{REFP},\,V_{REFN},\,V_{CM}
$$


而 ADC 转换关系近似为：


$$
D \propto \frac{V_{IN}}{V_{REFP}-V_{REFN}}
$$


所以 reference 的动态误差会直接调制 ADC 的量化尺度。

---


### 1.2 为什么 ADC 需要专门的 RVB

#### Bandgap 很准，但通常不适合直接驱动 CDAC

Bandgap/reference core 的设计重点通常是：

- DC accuracy；
- temperature coefficient；
- line sensitivity；
- low-frequency noise；
- low static power。

但高速 SAR 的 CDAC 是一个强烈的**开关电容动态负载**。当某一位翻转时：


$$
\Delta Q = C_i\Delta V_i
$$


若翻转发生在很短的 $\Delta t$ 内，reference 网络看到的瞬态平均电流约为：


$$
I_{REF}\approx\frac{\Delta Q}{\Delta t}
$$


随着 $\Delta t$ 减小，峰值电流可远大于 reference core 的静态偏置电流。

因此：

```text
Reference Core --X--> CDAC
Reference Core ---> RVB ---> CDAC
```

第二种才是高速 ADC 中更合理的系统结构。

---


### 1.3 Switched-Capacitor 负载与 Reference Error

#### 最重要的基本关系

reference 节点误差可以统一写成：


$$
V_{REF,err}(s)=Z_{REF}(s)\,I_{CDAC}(s)
$$


这里：

- $I_{CDAC}(s)$：CDAC switching 产生的动态 reference current；
- $Z_{REF}(s)$：从 CDAC 看向 reference network 的等效输出阻抗。

因此几乎所有 RVB 架构创新最终都在做以下事情之一：

1. 降低 $Z_{REF}(s)$；
2. 提高瞬态 source/sink current；
3. 增加本地 charge reservoir；
4. 缩短 reference settling time；
5. 降低 CDAC 每次切换的 $\Delta Q$；
6. 隔离不同 ADC/channel 之间的 reference interaction。

---

#### 为什么只看 DC 输出电阻远远不够？

低频时有：


$$
Z_{out,CL}(0)\approx\frac{Z_{out,OL}}{1+T(0)}
$$


但随着频率增加：


$$
|T(j\omega)|\downarrow
$$


于是：


$$
|Z_{out}(j\omega)|\uparrow
$$


所以一个 DC 输出阻抗很低的 opamp buffer，不代表它能很好地承受几百 MHz～GHz ADC 的 sub-ns CDAC switching。

高速 ADC 真正需要关注的是：


$$
\boxed{Z_{REF}(f)}
$$


而不是一个单独的 $R_{out,DC}$。

---

#### Reference error 为什么会形成非线性而不仅是噪声？

因为 SAR 的 CDAC switching pattern 与输入码相关。

因此：


$$
I_{CDAC}(t)=f(D_{SAR},t)
$$


进一步：


$$
V_{REF,err}(t)=Z_{REF}*I_{CDAC}(t)
$$


这意味着 reference ripple 与输入码存在相关性，可能表现为：

- gain error；
- DNL/INL；
- HD2/HD3 等谐波；
- SFDR 下降；
- SNDR/ENOB 下降；
- memory effect；
- TI-ADC 中的 channel-dependent spur。

所以 RVB 不只是“电源完整性”模块，它事实上是 ADC 线性度链路的一部分。

---


### 1.4 三种时间尺度：CDEC、Local Loop 与 Global Loop

![03_charge_timescales](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-reference-buffer/03_charge_timescales.png)

高速 reference system 最好按时间尺度理解。

#### 极短时间：输出节点与 CDEC 先供电荷

CDAC 翻转发生的最初瞬间，active loop 还来不及完全动作，此时本地电容首先提供电荷：


$$
\Delta V_{REF}\approx\frac{\Delta Q}{C_{DEC}+C_{par}}
$$


因此 CDEC 越大，瞬时 droop 越小。

---

#### 中等时间：local loop / FVF / Class-AB 输出级恢复

随后局部高速环路开始工作：


$$
\Delta V_{OUT}
\rightarrow
\Delta V_G
\rightarrow
\Delta I_{OUT}
\rightarrow
V_{OUT}\text{ recovery}
$$


这部分决定：

- fast settling；
- slew rate；
- source/sink 峰值能力；
- 高频 $Z_{out}$。

---

#### 较慢时间：global precision loop 恢复 DC accuracy

最后由高增益误差放大器/全局环路保证：


$$
V_{REF,OUT}\rightarrow V_{REF,TARGET}
$$


它主要负责：

- DC accuracy；
- PVT；
- low-frequency PSRR；
- low-frequency output impedance。

因此一个现代高速 RVB 很常见的思想是：


$$
\boxed{
\text{precision slow loop}
+
\text{fast local loop}
+
\text{charge reservoir}
}
$$


---


## 2. RVB 的核心指标与统一分析方法

### 2.1 DC Accuracy、Zout、Settling、SR 与 Source/Sink

---

#### DC Accuracy

若目标参考为 $V_{REF}$，定义：


$$
\epsilon_{DC}=V_{OUT}-V_{REF}
$$


对于 12-bit ADC，如果希望 reference static error 显著小于 0.5 LSB，则非常粗略地有：


$$
|\epsilon_{DC}|\ll \frac{V_{FS}}{2^{13}}
$$


但实际 reference 的 absolute error 可以通过系统增益校准部分吸收，因此更关键的是：

- 随时间变化；
- 随码型变化；
- channel-to-channel mismatch；
- nonlinearity。

---

#### Output Impedance

核心指标：


$$
Z_{out}(s)=\frac{v_{test}(s)}{i_{test}(s)}
$$


需要检查：

- DC；
- SAR bit-cycle 相关频率；
- sampling frequency；
- 可能的 package/bondwire resonance。

好的 RVB 不是要求所有频率上 $Z_{out}$ 都最小，而是要求在**ADC reference current 的主要谱能量范围内足够低且没有危险 peaking**。

---

#### Settling

若 CDAC switching 后允许误差：


$$
|\epsilon(t_{settle})|<\epsilon_{allow}
$$


对于一阶近似：


$$
\epsilon(t)=\epsilon_0 e^{-t/\tau}
$$


则：


$$
t_{settle}>\tau\ln\left(\frac{\epsilon_0}{\epsilon_{allow}}\right)
$$


12-bit 精度常让 settling 成为非常苛刻的指标。

---

#### Slew Rate

当瞬态进入大信号区时，线性小信号带宽不再决定恢复速度，而由：


$$
SR\approx\frac{I_{max}}{C_L}
$$


决定。

所以高速 RVB 必须同时满足：

- small-signal BW；
- large-signal SR。

---

#### Source / Sink Capability

CDAC 既可能从 reference 抽取电荷，也可能回灌：


$$
I_{REF}>0,\qquad I_{REF}<0
$$


因此单方向强驱动往往不够，理想情况是：


$$
|I_{source,max}|,\ |I_{sink,max}|\gg I_Q
$$


这正是 push-pull 与 Class-AB 架构的重要性。

---

#### Noise

RVB 噪声会直接叠加/调制 reference：


$$
V_{REF}(t)=V_{REF,ideal}+v_{n,ref}(t)
$$


由于：


$$
D\propto\frac{V_{IN}}{V_{REF}}
$$


reference noise 可以折算为输入等效误差。因此要关注：

- reference core noise；
- error amplifier noise；
- FVF/local-loop transistor noise；
- output-device noise；
- decap/filter 对噪声谱的整形。

---

#### PSRR

电源扰动到 reference：


$$
PSRR(f)=20\log_{10}\left|\frac{V_{DD}(f)}{V_{REF,err}(f)}\right|
$$


高速 RVB 常存在一个现实矛盾：

- local loop 很快；
- 但输出管可能直接耦合 supply noise。

因此不能只追求低 $Z_{out}$，也要看 supply feedthrough。

---

#### Stability

任何含反馈的 RVB 都需要分析：

- loop gain；
- phase margin；
- gain margin；
- load capacitance range；
- package inductance；
- CDEC 与 ESR/route R；
- PVT；
- 不同 source/sink operating point。

特别是多环结构：


$$
T_{global}(s),\quad T_{local}(s),\quad T_{aux}(s)
$$


不仅要分别稳定，还要防止环路相互作用。

---

#### Headroom

先进工艺中：


$$
V_{DD}\approx0.8\sim1.2\,V
$$


FVF、cascoded、Class-AB 堆叠晶体管会迅速消耗 headroom。

需要检查：


$$
V_{DS}>V_{DS,sat}
$$


以及整个输出范围内各关键管是否保持目标工作区。

---

#### Power Efficiency

仅看静态电流不够，RVB 更适合用：


$$
\eta_I=\frac{I_{peak}}{I_Q}
$$


理解瞬态效率。

Class-A：


$$
I_{peak}\sim I_Q
$$


Class-AB：


$$
I_{peak}\gg I_Q
$$


所以 Class-AB 特别适合“平时轻载、切换瞬间重载”的 SAR reference。

---


### 2.2 统一的 RVB 架构分析框架

以后看到任何新 RVB，不必先记名字，可以按照以下步骤分析。

#### Step 1：画出 DC signal path


$$
V_{REF,in}\rightarrow V_{REF,out}
$$


谁决定 DC 输出值？

---

#### Step 2：画 global feedback loop


$$
V_{out}
\rightarrow EA
\rightarrow driver
\rightarrow V_{out}
$$


求：


$$
T_{global}(s)
$$


---

#### Step 3：画 local fast loop

例如：


$$
V_{out}
\rightarrow M_1
\rightarrow M_2
\rightarrow V_{out}
$$


求：


$$
T_{local}(s)
$$


---

#### Step 4：分别分析 source 和 sink

#### VOUT 向下掉：

谁拉高？

#### VOUT 向上冲：

谁拉低？

不要只用一个“输出电流能力”概括。

---

#### Step 5：找 charge reservoir

包括：

- explicit CDEC；
- parasitic C；
- gate capacitance；
- flying capacitor；
- shared reference capacitor。

---

#### Step 6：构建 $Z_{REF}(s)$

至少包含：


$$
Z_{buffer}(s)
$$


以及：


$$
R_{route},\ L_{route/package},\ C_{DEC}
$$


最终得到：


$$
Z_{REF}(s)
$$


---

#### Step 7：用真实 CDAC switching current 激励

而不是只做 DC load step。

应检查：

- MSB switching；
- worst-case code transition；
- full SAR bit sequence；
- sampling/hold phase transition；
- multi-channel simultaneous switching。

---


## 3. 基础输出级：SF、SSF 与闭环 Opamp Buffer

### 3.1 架构总览

![02_rvb_architecture_tree](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-reference-buffer/02_rvb_architecture_tree.png)

从工程角度，可以将经典 RVB 分为以下几族：

1. SF / follower 型；
2. SSF / regulated follower 型；
3. Opamp closed-loop 型；
4. Push-Pull / Class-AB 输出级；
5. FVF 家族；
6. LDO-like / reference regulator；
7. Active RVB + CDEC；
8. capacitor-less / small-C RVB；
9. dynamic / charge-replenishment；
10. global + local / hierarchical / distributed；
11. replica / mirrored / per-channel RVB。

需要强调：这些类别并非互斥。

一个真正的芯片级 RVB 完全可能同时是：

> **Opamp global loop + Class-AB FVF local output + CDEC + per-channel local distribution**

因此“架构名”只是描述它最突出的设计机制。

---


### 3.2 Source Follower（SF）

#### 基本思想

MOS source follower 的输出取源极：


$$
V_{OUT}\approx V_{IN}-V_{GS}
$$


忽略 body effect、有限 $r_o$ 与负载：


$$
A_v\approx1
$$


输出阻抗量级：


$$
R_{out,SF}\approx\frac{1}{g_m+g_{mb}}
$$


粗略：


$$
\boxed{R_{out,SF}\sim\frac1{g_m}}
$$


---

#### 优点

- 结构非常简单；
- 内部高阻节点少；
- 本征速度高；
- 稳定性容易；
- 面积小；
- 低功耗。

---

#### 缺点

#### 输出阻抗仍不够低

高速高精度 CDAC 中：


$$
\Delta V_{REF}\approx I_{CDAC}R_{out}
$$


$1/g_m$ 往往还是偏大。

#### 有 level shift

例如 NMOS SF：


$$
V_{OUT}\approx V_{IN}-V_{GS}
$$


需要额外产生偏移后的控制电压。

#### source/sink 不对称

简单 follower 通常某一方向由主器件驱动，另一方向受 bias current 限制。

---

#### 适用场景

- 中低精度；
- 负载较小；
- 有较大 CDEC；
- 作为更复杂 RVB 的一个局部输出单元。

---


### 3.3 Super Source Follower（SSF）/ Regulated Follower

SSF 的思想是给 follower 加一条局部增益路径，使输出变化能更强地调节输出管。

若普通 follower 的开环输出阻抗为：


$$
R_o\sim\frac1{g_m}
$$


局部环路增益为 $T_{local}$，则：


$$
R_{out,SSF}\approx\frac{1/g_m}{1+T_{local}}
$$


若：


$$
T_{local}\sim g_mr_o
$$


则数量级可以降至：


$$
R_{out,SSF}\sim\frac1{g_m^2r_o}
$$


---

#### 直观理解

普通 SF：


$$
V_{OUT}\downarrow
\Rightarrow V_{GS}\uparrow
\Rightarrow I_{OUT}\uparrow
$$


属于器件自身的跟随作用。

SSF：


$$
V_{OUT}\downarrow
\Rightarrow \text{auxiliary gain}
\Rightarrow V_G\text{变化更大}
\Rightarrow I_{OUT}\uparrow\uparrow
$$


因此对输出扰动的抵抗更强。

---

#### 优点

- 输出阻抗显著低于 SF；
- local loop 通常较短；
- 速度较高；
- 复杂度低于“大 opamp + 输出级”。

#### 缺点

- 增加内部节点和额外极点；
- headroom 变差；
- PVT 下局部环路增益变化；
- 命名与 FVF/regulated source follower 在文献中存在交叉。

> 阅读论文时不要只看作者把电路叫 SSF 还是 FVF，而应实际画出 local feedback loop。

---


### 3.4 Opamp + Output Stage 闭环型 RVB

典型结构：

```text
VREF_IN --> Error Amplifier --> Output Driver --> VREF_OUT
                  ^                              |
                  |______________________________|
```

若全局环路：


$$
T(s)=A(s)\beta(s)
$$


则：


$$
Z_{out,CL}(s)\approx\frac{Z_{out,OL}(s)}{1+T(s)}
$$


---

#### 最大优势：低频精度高

闭环可以有效压制：

- $V_{TH}$；
- $V_{GS}$；
- output-device PVT；
- load regulation error。

若 unity feedback：


$$
V_{OUT}\approx V_{REF,IN}
$$


因此非常适合高分辨率 ADC。

---

#### 最大问题：高速并不等于高 DC gain

全局 opamp 随频率升高：


$$
|A(j\omega)|\downarrow
$$


因此：


$$
|T(j\omega)|\downarrow
$$


CDAC 高频瞬态发生时，全局环路可能尚未建立修正电流。

所以高速 RVB 常把任务拆成：

- global amplifier：DC/LF accuracy；
- local FVF / AB path：HF transient。

---

#### 输出级选择

可搭配：

- SF；
- SSF；
- common-drain push-pull；
- complementary class-AB；
- FVF；
- super-FVF。

因此“Opamp RVB”实际上是一类系统框架，而不是一个固定 transistor schematic。

---


## 4. 双向大电流输出：Push-Pull 与 Class-AB

### 4.1 Push-Pull 输出级

Complementary push-pull：

```text
              VDD
               |
             PMOS
               |
             VREF
               |
             NMOS
               |
              GND
```

分别负责：

- PMOS：source；
- NMOS：sink。

---

#### 为什么比单 follower 更适合 CDAC？

CDAC 可以出现双向 reference current：


$$
I_{REF}(t)\gtrless0
$$


因此 push-pull 可以分别处理：


$$
I_{source}
$$


和：


$$
I_{sink}
$$


避免一个方向必须依赖很小的 bias source。

---

#### 关键问题

- crossover behavior；
- dead zone；
- 两支输出器件的静态偏置；
- output common-mode；
- 对称性；
- 大信号稳定性。

---


### 4.2 Class-AB RVB

Class-AB 的核心目标不是简单增加输出管，而是：


$$
\boxed{I_{peak}\gg I_Q}
$$


在保持较低静态功耗的同时，瞬态让输出管强导通。

---

#### 对 SAR reference 为什么特别合适？

SAR 工作周期中：

- 大部分时间 reference current 不大；
- CDAC 翻转瞬间电流很大。

这正好符合 Class-AB 的负载画像。

若：


$$
I_Q=1\,mA
$$


但瞬态能：


$$
I_{peak}=10\sim20\,mA
$$


就比纯 Class-A 通过堆静态电流解决瞬态更高效。

---

#### 常见实现思想

- adaptive bias；
- dynamic gate boosting；
- complementary translinear control；
- local common-mode sensing；
- current mirror amplification；
- FVF + AB control。

---

#### 风险

- crossover distortion；
- internal node saturation；
- source/sink 两种状态极点位置不同；
- large-signal recovery 与 small-signal PM 不完全等价。

---


## 5. FVF 家族：从 FVF 到 Super-FVF 与 Class-AB FVF

### 5.1 Flipped Voltage Follower（FVF）

FVF 是高速 RVB 和 fast-transient LDO 中最重要的经典结构之一。

![04_fvf_local_feedback](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-reference-buffer/04_fvf_local_feedback.png)

---

#### 核心不是“flipped”这个名字，而是短局部反馈环

输出扰动被快速感知：


$$
\Delta V_{OUT}
\rightarrow
\Delta V_G
\rightarrow
\Delta I_{OUT}
$$


局部环路不经过完整高增益全局 opamp，因此可以拥有更高的局部带宽。

---

#### 输出阻抗

常见数量级可写为：


$$
R_{out,FVF}\approx
\frac{1}{g_{m1}(1+g_{m2}r_o)}
$$


当：


$$
g_{m2}r_o\gg1
$$


则：


$$
\boxed{
R_{out,FVF}\sim
\frac{1}{g_{m1}g_{m2}r_o}
}
$$


相比 SF：


$$
R_{out,SF}\sim\frac1{g_m}
$$


低一个约 $g_mr_o$ 的局部增益因子。

---

#### 物理意义

假设 CDAC 抽电荷：


$$
V_{REF}\downarrow
$$


FVF local loop 让 output device 很快增加 source current：


$$
I_{source}\uparrow
$$


所以无需等全局误差放大器完成完整响应。

---

#### 优点

- 很低的 $R_{out}$；
- local loop 快；
- 适合大瞬态；
- 易与 Class-AB、gain boosting 组合；
- 可以减少对超大 CDEC 的依赖。

---

#### 缺点

- headroom；
- local-loop stability；
- source/sink 可能不对称；
- internal node parasitic pole；
- 输出范围和器件饱和状态需要仔细验证。

---


### 5.2 Super-FVF / Gain-Boosted FVF

如果 conventional FVF 的 local gain：


$$
T_{local}\sim g_mr_o
$$


仍然不足，可以再增加 gain-boosting：


$$
T_{local}\sim A_{boost}g_mr_o
$$


于是：


$$
R_{out}\sim
\frac{1}
{g_m(1+A_{boost}g_mr_o)}
$$


在强增益条件下近似：


$$
R_{out}\sim\frac1{A_{boost}g_m^2r_o}
$$


---

#### 目标

主要用于：

- ultralow output impedance；
- 高精度 differential VREFP/VREFN；
- 较大的 switched-cap load。

---

#### 代价

每增加一个 gain path，就可能增加：

- high-impedance node；
- pole；
- parasitic capacitance；
- stability burden；
- power；
- startup complexity。

因此设计重点变为：


$$
\boxed{
Z_{out}\downarrow
\quad\text{但不能以严重 BW/PM 损失为代价}
}
$$


---


### 5.3 Class-AB FVF

这是现代高速 RVB 中非常有代表性的组合：


$$
\boxed{\text{FVF + Class-AB}}
$$


FVF 负责：


$$
Z_{out}\downarrow
$$


Class-AB 负责：


$$
I_{source/sink,peak}\uparrow
$$


---

#### 为什么是一个非常自然的组合？

FVF 提供 fast local error sensing，但 conventional FVF 的一个方向可能受静态 bias 限制。

Class-AB 将局部误差信号转换为双向大电流：


$$
V_{REF}\downarrow
\Rightarrow
I_{source}\uparrow\uparrow
$$



$$
V_{REF}\uparrow
\Rightarrow
I_{sink}\uparrow\uparrow
$$


非常匹配 SAR CDAC 的双向 charge exchange。

---

#### 对 pipeline-SAR 的意义

pipeline-SAR 中第一级通常：

- CDAC 大；
- reference switching charge 大；
- settling window 短；
- 其误差会被后级放大/映射到整体线性度。

因此第一级 reference buffer 往往比后级更需要：

- low $Z_{out}$；
- large peak current；
- fast recovery。

Class-AB FVF 因此是值得优先研究的候选。

---


### 5.4 SF、SSF、FVF 的统一理解

不要简单理解为“三个完全平行的输出级”。

更好的理解是：


$$
SF
$$


提供基础电压跟随，输出阻抗约：


$$
\frac1{g_m}
$$


引入 local feedback 后：


$$
R_{out}\rightarrow\frac{1/g_m}{1+T_{local}}
$$


SSF、regulated follower、FVF 都属于利用局部环路增强 follower 的设计思想，只是：

- sensing node；
- controlling device；
- bias topology；
- input/output relationship；

不同。

所以阅读 transistor schematic 时，应优先找：

1. 谁是真正的 output device？
2. VOUT 的变化反馈到哪个 gate？
3. feedback path 上有几个增益级？
4. local loop gain 是多少？
5. source 和 sink 分别由哪条路径提供？

---


## 6. Reference Regulator、CDEC 与动态补能

### 6.1 LDO-like / Reference Regulator

某些 RVB 从拓扑上几乎就是一个小型 LDO：

```text
Reference Core
    |
Error Amplifier
    |
Pass / Output Device
    |
 VREF_OUT
```

---

#### 与普通 LDO 的区别仍在“设计目标”

普通 LDO：

- load regulation；
- line regulation；
- dropout；
- supply current；
- power-rail transient。

ADC reference regulator：

- reference accuracy；
- output noise；
- code-dependent transient；
- very low $Z_{REF}(f)$；
- VREFP/VREFN matching；
- settling before each SAR decision。

---

#### FVF-LDO

FVF 也大量用于 capacitor-less / fast-transient LDO，因此 LDO 与 RVB 的技术边界会非常模糊。

可以将一部分高速 reference regulator 理解为：


$$
\boxed{\text{为 ADC reference load 特化的 fast-transient LDO}}
$$


---


### 6.2 Active RVB + Large Decoupling Capacitor

这是最经典、最实用的系统架构之一：

```text
RVB ---- Rroute ---- VREF node ---- CDAC
                       |
                     CDEC
                       |
                      GND
```

---

#### CDEC 的作用

CDAC 突然需要 $\Delta Q$ 时：


$$
\Delta V_{REF}\approx\frac{\Delta Q}{C_{DEC}}
$$


只要：


$$
C_{DEC}\gg C_{DAC,switched}
$$


瞬时 reference droop 就能显著降低。

---

#### 为什么 CDEC 不能无限加大？

#### 面积

几十～几百 pF 的片上电容面积可能很大。

#### 启动与充电


$$
t_{startup}\uparrow
$$


#### 环路稳定性

大负载电容会改变 output pole：


$$
p_{out}\approx\frac1{R_{out}C_{DEC}}
$$


#### RLC resonance

实际系统还包含：

- bondwire/package inductance；
- metal routing R/L；
- CDEC ESR；
- switch resistance。

因此：


$$
Z_{REF}(s)
$$


可能出现 resonance/peaking。

---

#### 更准确的理解

不是：

> “CDEC 越大越好”。

而是：

> **CDEC + active RVB + routing/package 共同形成 reference impedance shaping network。**

---


### 6.3 Capacitor-less / Small-C RVB

另一个发展方向是尽量减少大 decap：


$$
C_{DEC}\downarrow
$$


通过：

- FVF；
- super-FVF；
- high-BW local loop；
- Class-AB high peak current；

实现足够快的 reference recovery。

---

#### 优点

- 节省片上面积；
- 减少大电容 charging energy；
- 便于多通道局部集成。

#### 代价

active buffer 本身必须更强：


$$
g_m\uparrow,\quad BW\uparrow,\quad I_{peak}\uparrow
$$


所以常出现：


$$
\boxed{
C_{DEC}\leftrightarrow P_{RVB}
}
$$


的基本 trade-off。

---


### 6.4 Dynamic / Charge-Replenishment RVB

SAR reference load 的最大特点之一是**时序可预测**。

既然知道 CDAC 何时翻转，就可以让 RVB 与 ADC clock 协同。

---

#### 常见思路

#### Precharge

在 SAR conversion 前预先把 local reservoir 充到目标 reference。

#### Dynamic Bias Boost

只有在 switching window 增大输出级偏置：


$$
I_Q(t)=
\begin{cases}
I_{low}, & idle\\
I_{boost}, & conversion
\end{cases}
$$


#### Charge Replenishment

使用辅助电容/开关，在 reference droop 后主动补充电荷。

#### Predictive / Phase-Aware Drive

利用已知 sampling / conversion phase，提前开启高驱动路径。

---

#### 本质

把传统连续时间模拟设计：


$$
\text{always-on regulator}
$$


变成：


$$
\boxed{
\text{ADC-timing-aware reference driver}
}
$$


以换取能效。

---


## 7. 多通道与 TI-ADC：Hierarchical、Replica 与 Per-Channel RVB

### 7.1 Global + Local / Hierarchical RVB

![05_hierarchical_reference_distribution](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-reference-buffer/05_hierarchical_reference_distribution.png)

对多通道/TI ADC，如果所有子 ADC 直接挂在同一个 reference 节点：


$$
V_{REF,err}
=
Z_{REF}
\sum_{k=1}^{N}I_{CDAC,k}
$$


某一路的 switching 会影响其它通道。

---

#### Hierarchical 架构

```text
Reference Core
     |
Global Buffer
     |
Reference Bus
 |      |      |
Local  Local  Local
RVB1   RVB2   RVB3
 |      |      |
ADC1   ADC2   ADC3
```

---

#### 功能分工

#### Global RVB

负责：

- absolute accuracy；
- low-frequency regulation；
- reference distribution；
- channel average tracking。

#### Local RVB

负责：

- local high-frequency current；
- channel isolation；
- reducing inter-channel interaction；
- 缩短 reference routing。

---

#### 对 TI-ADC 的意义

不同通道 reference interaction 可能形成周期性误差，最终表现为：

- interleaving spur；
- channel-dependent distortion；
- modulation spur。

所以高采样率 TI-ADC 中 reference distribution 本身就是系统级架构问题。

---


### 7.2 Replica / Mirrored / Per-Channel FVF

在多通道系统里，还可以采用：

- per-channel FVF；
- voltage-mirrored FVF；
- replica-biased local buffer；
- shared control + distributed output device。

核心目的通常是两个：

1. 保留所有 local references 的 DC 一致性；
2. 高频上隔离各路 CDAC 动态电流。

---

#### 一个重要 trade-off

完全独立：


$$
\text{isolation}\uparrow
$$


但：


$$
\text{mismatch}\uparrow
$$


完全共享：


$$
\text{matching}\uparrow
$$


但：


$$
\text{channel coupling}\uparrow
$$


因此 mirrored/replica/hierarchical 架构本质上在做：


$$
\boxed{
\text{matching vs isolation}
}
$$


的折中。

---


## 8. 架构比较、设计建议与仿真验证

### 8.1 架构总对比

| 架构 | DC 精度 | 高频 $Z_{out}$ | Source/Sink | 静态功耗 | 面积 | Headroom | 稳定性难度 | 典型适用 |
|---|---|---|---|---|---|---|---|---|
| SF | 中 | 中 | 弱/不对称 | 低 | 低 | 较好 | 低 | 简单/中速 |
| SSF | 中 | 低 | 中 | 低~中 | 低 | 中 | 中 | 中高速 |
| Opamp + Driver | 高 | 取决于局部输出级 | 可强 | 中 | 中 | 中 | 中~高 | 高精度 |
| Push-Pull | 中 | 低 | 强、双向 | 中 | 低 | 好~中 | 中 | 高速 |
| Class-AB | 中~高 | 低 | 很强、双向 | 高效率 | 中 | 中 | 中~高 | 高速 |
| FVF | 中~高 | 很低 | 强 | 低~中 | 低 | 较差 | 中 | 高速 SAR |
| Super/Gain-Boosted FVF | 高 | 极低 | 强 | 中 | 中 | 较差 | 高 | 高精度/大 CDAC |
| Class-AB FVF | 高 | 极低 | 极强双向 | 高效率 | 中 | 较差 | 高 | 高速高精度 |
| LDO-like | 高 | LF 很低，HF 取决设计 | 强 | 中 | 中 | dropout 约束 | 高 | reference regulator |
| RVB + Large CDEC | 高 | HF 很低 | reservoir 强 | 中 | 大 | 取决 buffer | RLC 需分析 | 经典方案 |
| Capacitor-less | 高 | 要求 active 极低 | 强 | 较高 | 小 | 严格 | 高 | 面积受限/高速 |
| Dynamic / Refill | 中~高 | phase 内很低 | 很强 | 高能效 | 中 | 视实现 | 高 | SAR 特化 |
| Global + Local | 高 | 很低 | 强 | 中~高 | 中~大 | 视 local | 高 | TI/多通道 |

> 表中的“高/低”是相对架构特征，不是绝对性能排序。一个优秀 SF-based buffer 可能优于设计不佳的复杂 FVF。

---


### 8.2 五条架构演进主线

#### 主线 A：降低 follower 输出阻抗


$$
SF
\rightarrow
SSF
\rightarrow
FVF
\rightarrow
Super/Gain\text{-}Boosted\ FVF
$$


核心：


$$
R_{out}\downarrow
$$


---

#### 主线 B：增强双向瞬态驱动


$$
Class\text{-}A
\rightarrow
Push\text{-}Pull
\rightarrow
Class\text{-}AB
\rightarrow
Class\text{-}AB\ FVF
$$


核心：


$$
I_{source/sink,peak}\uparrow
$$


同时：


$$
I_Q\downarrow
$$


---

#### 主线 C：把不同时间尺度拆开


$$
\text{Global precision loop}
+
\text{Local fast loop}
+
C_{DEC}
$$


核心：

- LF：精度；
- MF：active recovery；
- HF：charge reservoir。

---

#### 主线 D：减小大电容依赖


$$
RVB+C_{DEC}
\rightarrow
Small\text{-}C
\rightarrow
Capacitor\text{-}less
$$


通过：


$$
g_m,\ BW,\ I_{peak}
$$


换面积。

---

#### 主线 E：从集中式走向分布式


$$
Shared\ RVB
\rightarrow
Global+Local
\rightarrow
Per\text{-}Channel/Replica/Mirrored
$$


核心解决：


$$
\text{inter-channel coupling}
$$


---


### 8.3 面向 12-bit、几百 MS/s～GS/s pipeline-SAR 的建议

对于这类 ADC，尤其第一级 4~6 bit CDAC + interstage MDAC / residue amplification，RVB 建议优先关注以下组合。

#### 优先候选


$$
\boxed{
\text{Global precision loop}
+
\text{Class-AB FVF local output}
+
\text{moderate CDEC}
}
$$


原因：

- 12-bit 需要精度；
- 几百 MS/s 以上要求快速恢复；
- 第一级 CDAC 的 MSB switching charge 较大；
- Class-AB 避免用巨大的静态电流硬顶 transient；
- moderate CDEC 把最高频瞬态先吸收掉。

---

#### 不建议只优化 DC gain

如果只做一个 60–80 dB opamp，然后看到：


$$
V_{OUT,DC}\approx V_{REF}
$$


并不能证明 reference buffer 满足高速 ADC。

必须验证：


$$
Z_{REF}(f)
$$


以及真实 SAR switching 下的：


$$
V_{REF}(t)
$$


---

#### 第一级往往比第二级更关键

第一级：

- 输入摆幅最大；
- CDAC 往往更大；
- reference switching energy 大；
- 非线性误差直接影响 residue；
- error 会进入后续数字重构。

所以可以考虑：

- Stage-1 独立更强 RVB；
- Stage-2 使用较小 local buffer；
- 或两级共用 global reference、各自 local driver。

---


### 8.4 仿真方法

#### DC

- VREF accuracy；
- load regulation；
- output swing；
- source/sink static current；
- PVT。

---

#### AC / STB

分别检查：

- global loop；
- local loop；
- auxiliary loop。

输出：


$$
A_{loop}(f),\ PM,\ GM
$$


以及：


$$
Z_{out}(f)
$$


---

#### Transient Load Step

至少双向：


$$
+\Delta I
$$


和：


$$
-\Delta I
$$


提取：

- undershoot；
- overshoot；
- recovery time；
- slew rate。

---

#### 最关键：真实 CDAC 联合仿真

将实际 CDAC 接上 RVB，观察：


$$
V_{REFP}(t),\quad V_{REFN}(t)
$$


在每一个 SAR bit decision 前的 residual error。

建议至少覆盖：

- full-scale sine；
- near-full-scale；
- mid-code；
- worst-case code transition；
- 不同 input polarity；
- corner + mismatch。

---

#### TI-ADC

应额外做：

- 单通道切换其它通道静止；
- 多通道同时切换；
- 错相切换；
- reference bus parasitic；
- local buffer mismatch。

观察 channel interaction。

---


### 8.5 常见误区

#### 误区 1：RVB 就是 voltage follower

错误。现代 RVB 通常是一个多时间尺度的 feedback + reservoir 系统。

#### 误区 2：DC 输出电阻低就够了

错误。高速 ADC 更应该看：


$$
Z_{out}(f)
$$


#### 误区 3：大 CDEC 一定有利

错误。还要考虑：

- area；
- startup；
- loop pole；
- package resonance；
- routing。

#### 误区 4：只要 source current 强就行

错误。CDAC 存在回灌，sink 也重要。

#### 误区 5：FVF 一定比 SSF 好

错误。要比较具体：

- loop gain；
- BW；
- headroom；
- noise；
- PM；
- load range。

#### 误区 6：reference error 只是 gain error

错误。code-dependent reference ripple 会形成非线性和谐波。

---


## 9. 论文阅读框架、心智模型与学习路线

### 9.1 阅读一篇 RVB 论文时建议记录的参数

建议做一个固定模板：

#### Architecture
- Global loop：
- Local loop：
- Output stage：
- Class-A / AB：
- FVF / SSF：
- CDEC：
- Differential / single-ended：
- Global/local distribution：

#### Supply

$$
V_{DD}=
$$


#### Reference

$$
V_{REFP}=,\quad V_{REFN}=
$$


#### Load

$$
C_L=
$$



$$
I_{peak}=
$$


#### Performance

$$
R_{out,DC}=
$$



$$
Z_{out}(f)=
$$



$$
BW=
$$



$$
SR=
$$



$$
t_{settle}=
$$



$$
V_{undershoot/overshoot}=
$$



$$
I_Q=
$$



$$
Noise=
$$



$$
PSRR=
$$


#### ADC Context
- ADC architecture：
- resolution：
- sampling rate：
- CDAC size：
- switching scheme：
- on-chip/off-chip decap：
- 是否 TI：

这样几篇论文就可以横向比较。

---


### 9.2 最终心智模型

现代高速 ADC 的 reference system 可以抽象为：

```text
                     low-frequency accuracy
Reference Core ---> Global Precision Loop
                           |
                           v
                     Local Fast Loop
                    /               \
              Source Path         Sink Path
                    \               /
                         VREF
                          |
                   CDEC / Reservoir
                          |
                         CDAC
```

它解决四个核心问题：


$$
\boxed{\text{准}}
$$



$$
\boxed{\text{低 }Z_{out}}
$$



$$
\boxed{\text{快}}
$$



$$
\boxed{\text{双向大电流}}
$$


对多通道系统再增加第五个：


$$
\boxed{\text{隔离}}
$$


---


### 9.3 推荐学习顺序

如果目标是快速建立 RVB 的完整知识体系，建议顺序：

1. **SF / SSF**：理解 $1/g_m$ 输出阻抗；
2. **Feedback 与 $Z_{out}/(1+T)$**：建立统一数学框架；
3. **FVF**：理解 fast local loop；
4. **Push-Pull / Class-AB**：理解双向大信号 transient；
5. **RVB + CDEC**：理解 active/passive 时间尺度分工；
6. **LDO-like reference regulator**：理解 RVB 与 LDO 的交叉；
7. **Capacitor-less / dynamic buffer**：理解效率与面积；
8. **Global + Local / TI reference distribution**：进入系统级 reference network。

---


### 9.4 代表性文献与进一步阅读

以下文献适合沿着上述架构脉络阅读（建议在 IEEE Xplore/Zotero 中按 RVB、FVF、reference-error、TI-reference 四个标签整理）。

1. **C. H. Chan et al.**, “60-dB SNDR 100-MS/s SAR ADCs With Threshold Reconfigurable Reference Error Calibration,” *IEEE Journal of Solid-State Circuits*, 2017.  
   - 关注：SAR reference generation / FVF 与 reference error。

2. **J. Xue et al.**, “A 10-bit 160MS/s SAR ADC with Fast-Response Reference Voltage Buffer,” 2018.  
   - 关注：FVF RV-buffer、无大 decoupling capacitor 的 reference recovery。

3. **A Reference Buffer with High-Efficiency for High-Speed and High-Precision Switched-Capacitor ADCs**, 2018.  
   - 关注：高速高精度 switched-capacitor ADC 的 integrated RVB 能效。

4. **C. Li et al.**, “Analysis of Reference Error in High-Speed SAR ADCs With Capacitive DAC,” *IEEE Transactions on Circuits and Systems I*, 2019.  
   - 关注：有限 reference impedance、reference ripple 与 SAR error 的理论分析。

5. **W. He et al.**, “A Low Power Reference Voltage Buffer and High Density Capacitor Array for SAR ADC,” 2020.  
   - 关注：FVF、低功耗 RVB。

6. **B. Ma et al.**, “Design of A Reference Buffer with Ultralow Output Resistance,” 2021.  
   - 关注：differential reference、ultralow output resistance。

7. **Y. Zeng et al.**, “An Auxiliary-Loop-Enhanced Fast-Transient FVF LDO as Reference Voltage Supply for High-Speed SAR ADCs,” 2022.  
   - 关注：FVF-LDO、auxiliary loop、fast transient、RVB/LDO 边界。

8. **L. Ricci et al.**, “A 2GS/s 11b 8× Interleaved ADC with 9.2 ENOB and 69.9-dB SFDR,” 2023.  
   - 关注：voltage-mirrored FVF reference buffer、TI channel interaction。

9. **I. Kim et al.**, “A Fully Integrated FVF Based Low-Noise Voltage Buffer for ADC Reference,” 2024.  
   - 关注：FVF、低噪声、fully integrated precision reference buffer。

---


### 9.5 结论

如果把所有架构压缩成一句话：


$$
\boxed{
\text{现代高速 RVB}
\approx
\text{高精度慢环}
+
\text{高速局部反馈}
+
\text{高效双向输出级}
+
\text{适量储能电容}
+
\text{必要时的分布式隔离}
}
$$


因此设计 RVB 时不应该停留在“SF、SSF、FVF 谁更好”的层面，而应对整个 reference network 问：

1. **DC reference 谁保证？**
2. **CDAC 翻转第一瞬间的电荷谁提供？**
3. **VREF droop 后谁最快感知并恢复？**
4. **source 和 sink 两个方向分别有多强？**
5. **$Z_{REF}(f)$ 是否在关键频段足够低且无 peaking？**
6. **reference 是否在下一次 comparator decision 前进入允许误差带？**
7. **多通道之间是否通过 reference bus 相互调制？**

只要这七个问题回答清楚，一个 RVB 架构的核心基本就已经分析完整了。


## 相关笔记

- [Bandgap 基准源：架构与设计](/GarveyDing_AcademicPages/blog/bandgap-reference/)
- [电路零极点：原理、分析与稳定性](/GarveyDing_AcademicPages/blog/circuit-poles-and-zeros/)
- [电路噪声：从 MOS 器件到系统设计](/GarveyDing_AcademicPages/blog/circuit-noise/)
- [ADC 架构：分类、比较与选型](/GarveyDing_AcademicPages/blog/adc-architectures/)
