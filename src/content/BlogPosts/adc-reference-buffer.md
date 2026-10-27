---
title: ADC Reference Voltage Buffer（RVB）：架构与设计
date: '2026-10-26'
excerpt: 面向高速和高精度 ADC，分析 RVB 在开关电容脉冲负载下的架构、动态指标与设计方法。
tags:
- 学习记录
- adc
- rvb
- reference-buffer
---

# ADC Reference Voltage Buffer（RVB）：架构与设计

> [!abstract] 核心定位
> 面向高速和高精度 ADC，分析 RVB 在开关电容脉冲负载下的架构、动态指标与设计方法。

---

> **适用范围**：本文主要讨论高速/高精度 SAR ADC、pipeline-SAR ADC、TI-ADC 中用于驱动 CDAC 的 Reference Voltage Buffer（RVB）。  
> **核心观点**：RVB 的本质不是“把一个电压复制出来”，而是在 CDAC 周期性、强脉冲、双向电荷交换的负载下，使参考节点在决策窗口内保持足够准确、足够低阻抗并快速恢复。

---


> [!info] 层次化结构
> 保留原有 **9 个主章节**，2026-10-26 版在原笔记基础上扩充小信号推导、Capless 与主极点辨析、Class-AB、差分参考误差、TI-ADC reference distribution、测试流程与已核对文献。图中蓝色框图为原创教学示意，**不是论文原图/晶体管级网表**。

## 目录

1. RVB 的系统定位与负载本质
   - 1.1 一句话建立整体概念
   - 1.2 为什么 ADC 需要专门的 RVB
   - 1.3 Switched-Capacitor 负载与 Reference Error
   - 1.4 三种时间尺度：CDEC、Local Loop 与 Global Loop
   - 1.5 从电荷守恒推导参考误差与码相关非线性
2. RVB 的核心指标与统一分析方法
   - 2.1 DC Accuracy、Zout、Settling、SR 与 Source/Sink
   - 2.2 统一的 RVB 架构分析框架
   - 2.3 将 ADC 精度分配到参考动态误差预算
3. 基础输出级：SF、SSF 与闭环 Opamp Buffer
   - 3.1 架构总览
   - 3.2 Source Follower（SF）
   - 3.3 Super Source Follower（SSF）/ Regulated Follower
   - 3.4 Opamp + Output Stage 闭环型 RVB
   - 3.5 SF、SSF、FVF 的信号路径与输出阻抗辨析
4. 双向大电流输出：Push-Pull 与 Class-AB
   - 4.1 Push-Pull 输出级
   - 4.2 Class-AB RVB
   - 4.3 双向瞬态能力与 Class-AB 实测论文
5. FVF 家族：从 FVF 到 Super-FVF 与 Class-AB FVF
   - 5.1 Flipped Voltage Follower（FVF）
   - 5.2 Super-FVF / Gain-Boosted FVF
   - 5.3 Class-AB FVF
   - 5.4 SF、SSF、FVF 的统一理解
   - 5.5 FVF 环路极性、小信号推导与稳定性
6. Reference Regulator、CDEC 与动态补能
   - 6.1 LDO-like / Reference Regulator
   - 6.2 Active RVB + Large Decoupling Capacitor
   - 6.3 Capacitor-less / Small-C RVB
   - 6.4 Dynamic / Charge-Replenishment RVB
   - 6.5 外接 C 与 Capless 的主极点、补偿和真实网络阻抗
7. 多通道与 TI-ADC：Hierarchical、Replica 与 Per-Channel RVB
   - 7.1 Global + Local / Hierarchical RVB
   - 7.2 Replica / Mirrored / Per-Channel FVF
   - 7.3 20 GS/s、32 路 TI-ADC 的参考分配案例
8. 架构比较、设计建议与仿真验证
   - 8.1 架构总对比
   - 8.2 五条架构演进主线
   - 8.3 面向 12-bit、几百 MS/s～GS/s pipeline-SAR 的建议
   - 8.4 仿真方法
   - 8.5 常见误区
   - 8.6 按 CDAC 时序构建可执行的验证计划
9. 论文阅读框架、心智模型与学习路线
   - 9.1 阅读一篇 RVB 论文时建议记录的参数
   - 9.2 最终心智模型
   - 9.3 推荐学习顺序
   - 9.4 代表性文献与进一步阅读
   - 9.5 结论
   - 9.6 文献分组、核验状态与论文配图索引

## 1. RVB 的系统定位与负载本质

### 1.1 一句话建立整体概念

可以把 ADC 的供电与基准链路分成三类角色：

- **[[Bandgap 基准源：架构与设计|Bandgap / Reference Core]]：负责“准”**——生成温漂小、长期稳定的基准。
- **LDO：负责“供电稳”**——生成干净的 AVDD/DVDD。
- **RVB：负责“把准确的 reference 变硬”**——在 CDAC 瞬态抽取/回灌电荷时仍维持 VREFP/VREFN。

![01_reference_system_overview](/images/blog/learning-notes/adc-reference-buffer/01_reference_system_overview.svg)

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

![03_charge_timescales](/images/blog/learning-notes/adc-reference-buffer/03_charge_timescales.svg)

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


### 1.5 从电荷守恒推导参考误差与码相关非线性（新增）

![09_reference_network_impedance](/images/blog/learning-notes/adc-reference-buffer/09_reference_network_impedance.svg)

#### 1.5.1 单次 CDAC 切换究竟从参考端抽走多少电荷？

对于第 $k$ 次 SAR 决策，发生切换的电容集合为 $\mathcal S_k$。忽略开关寄生时，某一路参考端的电荷交换可写为：

$$
\Delta Q_{\mathrm{ref},k}=\sum_{i\in\mathcal S_k}\alpha_{i,k} C_i\,\Delta V_{b,i,k},
$$

其中 $\alpha_{i,k}$ 取决于正/负参考端、顶板电压与开关极性，不应简单把所有 $C_i\Delta V$ 无符号相加。若参考电流正方向定义为“从 RVB 流向 CDAC”，则可用 $i_{\mathrm{ref}}(t)$ 描述每次脉冲；包括开关导通电阻、走线寄生及实际开关波形时，峰值电流通常不能仅由 $\Delta Q/\Delta t$ 准确预测。

当反馈带宽尚未起作用而本地参考储能电容 $C_{\mathrm{eff}}$ 主导时，初始电压跳变的一阶近似为：

$$
\Delta V_{\mathrm{ref}}(0^+)\simeq-\frac{\Delta Q_{\mathrm{ref}}}{C_{\mathrm{eff}}}.
$$

这是 **charge sharing / 初始跌落** 近似，不代表整个 bit cycle 的最终 settling error。$C_{\mathrm{eff}}$ 还包含 CDAC 在该时刻反射到参考端的有效电容和寄生电容。

#### 1.5.2 从单次脉冲到整段 SAR 周期

在小扰动、近似线性时不变（LTI）的条件下：

$$
\delta v_{\mathrm{ref}}(t)=-(z_{\mathrm{ref}}*i_{\mathrm{ref}})(t).
$$

注意负号依赖电流定义，核心是 **$Z_{REF}(s)$ 与实际电流激励共同决定参考扰动**。真实多环 RVB 存在大信号非线性（Class-AB、限流、器件饱和），此时不能只靠 LTI 卷积代替 Spectre transient。

- **静态比例误差**：参考端整体有固定偏差，主要表现为 gain error，可能通过增益校准吸收。
- **周期性残差**：每次 bit trial 未完全恢复，导致当前 bit 的参考电平依赖前几次翻转，形成 memory effect。
- **码相关误差**：$\Delta Q_{k}$ 取决于 bit pattern，故 $\delta V_{REF}$ 也与输入码相关，可能产生 INL/DNL、HD2/HD3 及 SFDR 劣化。
- **通道相互作用**：不同子 ADC 共用总线，会把其他通道的 $i_{REF,k}$ 变成当前通道的参考扰动。

**核心文献**：Cheng Li *et al.*, *IEEE TCAS-I*, 2019, “Analysis of Reference Error in High-Speed SAR ADCs With Capacitive DAC,” DOI: [10.1109/TCSI.2018.2861835](https://doi.org/10.1109/TCSI.2018.2861835)。这是参考网络建模与误差机理的优先精读文献。

> [!note] 不要混淆 $I_{avg}$ 和瞬态驱动要求
> $I_{avg}\approx f_s\sum\Delta Q$ 可用于估计平均补能量，但 **RVB 的 peak source/sink、电荷重分布瞬间波形和每一位决策前的残差** 才决定高速动态精度。ADI 的 [Voltage Reference Design for Precision SAR ADCs](https://www.analog.com/en/resources/analog-dialogue/articles/precision-successive-approximation-adcs.html) 给出了商用 SAR 参考输入动态电流的实测示意。

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


### 2.3 将 ADC 精度分配到参考动态误差预算（新增）

![10_refp_refn_common_mode](/images/blog/learning-notes/adc-reference-buffer/10_refp_refn_common_mode.svg)

#### 2.3.1 先区分 ADC LSB 和 reference 电压允许偏移

若 ADC 差分满量程为 $V_{FS,diff}$：

$$
V_{LSB}=\frac{V_{FS,diff}}{2^N}.
$$

例如 12-bit、$V_{FS,diff}=0.8\,\mathrm{V_{pp}}$，输出折算的理想 LSB 约为 $195.3\,\mu\mathrm V$。**不能由此直接规定每一条 VREFP/VREFN 参考端的波动必须小于 195 µV**：参考端扰动先经过 CDAC 权重与该次 bit 决策的灵敏度映射，其允许误差取决于级间增益、冗余位、开关方案与数字重构。

一个更正确的方法是先建立：

$$
\delta V_{DAC,k}\simeq
\frac{\partial V_{DAC,k}}{\partial V_{REFP}}\delta V_{REFP,k}+
\frac{\partial V_{DAC,k}}{\partial V_{REFN}}\delta V_{REFN,k}+
\frac{\partial V_{DAC,k}}{\partial V_{CM}}\delta V_{CM,k}.
$$

然后将 $\delta V_{DAC,k}$ 传递到 ADC 最终输出（考虑 stage-1 冗余和 residue gain），再分配为总体噪声/失真预算的一部分。PN/LMS 等静态或缓变增益校准**不保证**能消除码相关、bit-time-dependent reference settling error。

#### 2.3.2 区分差模与共模参考错误

$$
\delta V_{REF,diff}=\delta V_{REFP}-\delta V_{REFN},\qquad
\delta V_{REF,CM}=\frac{\delta V_{REFP}+\delta V_{REFN}}{2}.
$$

差模参考扰动更直接改变 DAC 有效权重；共模扰动可能通过开关电容耦合、比较器共模敏感度、运放输入共模和 P/N 不匹配转换成差模误差。**共模波动不一定自动抵消**，能否抵消必须由实际差分 CDAC 拓扑验证。

#### 2.3.3 把 settling spec 写在锁存时刻

![11_sar_bitcycle](/images/blog/learning-notes/adc-reference-buffer/11_sar_bitcycle.svg)

对每一次比较器 latch，定义 $t_{k,lat}$：

$$
\varepsilon_{k}^{ref}=V_{REF}(t_{k,lat}^{-})-V_{REF,target}.
$$

最危险情况不一定是 MSB：MSB 电荷最大，但后续 bit 的恢复窗口更短、历史残差可能累积。应同时覆盖 **MSB 大阶跃、连续同向脉冲、回灌脉冲、差分 P/N 非对称切换、周期边界记忆效应**。波形窗口要覆盖完整转换与相邻周期，不能只截取一次 bit transition。

## 3. 基础输出级：SF、SSF 与闭环 Opamp Buffer

### 3.1 架构总览

![02_rvb_architecture_tree](/images/blog/learning-notes/adc-reference-buffer/02_rvb_architecture_tree.svg)

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


### 3.5 SF、SSF、FVF 的信号路径与输出阻抗辨析（新增）

![06_sf_ssf_fvf](/images/blog/learning-notes/adc-reference-buffer/06_sf_ssf_fvf.svg)

- **SF**：普通共漏跟随器，输出端的器件局部作用已经给出 $\sim 1/(g_m+g_{mb})$ 的阻抗；并非“完全没有反馈”。
- **SSF**：通过辅助晶体管/放大路径增强调节，通常在内部节点构成 local negative feedback，改善输出阻抗和速度。名称应以论文原理图为准。
- **FVF**：典型形式把一个反向检测器与跟随器的 gate 控制组成短局部闭环。其增益和低阻抗来源于 $v_{out}\to v_{gate}\to i_{pass}\to v_{out}$。

共同形式（输出注入测试电流、假定闭环稳定且反馈类型适用）为：

$$
Z_{out,CL}(s)\approx\frac{Z_{out,0}(s)}{1+T_{local}(s)}.
$$

这里的 $Z_{out,0}$ 是**断开相应局部环路、保留其他条件和负载后的等效输出阻抗**；不能把普通源跟随器 $1/g_m$ 与某个高增益输出级 $r_o$ 的模型混用。频率越高，$T_{local}$ 的相位和幅度都重要，若 $T$ 接近 $-1$，反而可能产生输出阻抗峰值。

![Shen et al. 2024: Source follower and FVF buffer comparison (online)](https://www.mdpi.com/chips/chips-03-00015/article_deploy/html/images/chips-03-00015-g016.png)

*论文配图 E：Shen et al., Chips 2024, Fig. 16；[来源、CC BY 4.0](https://www.mdpi.com/2674-0729/3/4/15)。用于区分 SF/FVF 的带宽、增益与噪声代价。*

**原始 FVF 教程论文**：R. González Carvajal *et al.*, “The Flipped Voltage Follower: A Useful Cell for Low-Voltage Low-Power Circuit Design,” *IEEE TCAS-I*, 52(7), 1276–1291, 2005, [DOI](https://doi.org/10.1109/TCSI.2005.851387)。这篇比只看 LDO 文献更适合打好 FVF 晶体管结构基础。

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


### 4.3 双向瞬态能力与 Class-AB 实测论文（新增）

![07_classab_source_sink](/images/blog/learning-notes/adc-reference-buffer/07_classab_source_sink.svg)

#### 4.3.1 为什么输出级“强 source”不代表“强 sink”？

以常见的互补输出级为例，参考端跌落时主要靠 PMOS/上拉支路提供 $I_{source}$；参考端被 CDAC 回灌抬升时，则需要 NMOS/下拉支路吸收 $I_{sink}$。两条路径的偏置、电流上限、栅极驱动、电荷存储与 settling 常数均可能不同。

对 Class-AB，应该分别测量：

$$
I_{source,pk},\qquad I_{sink,pk},\qquad t_{rec,source},\qquad t_{rec,sink},\qquad I_Q.
$$

$\eta_{peak}=I_{peak}/I_Q$ 只是峰值电流放大比，**不是严格的功率效率定义**；真实效率还要包含供电与参考节点的电压、开关频率及偏置能耗。

#### 4.3.2 2026 年针对流水线 ADC 的直接参考

L. Zeng, M. Wang, R. Yin, Y. Gu, Y. Zhang, Z. Tang, “A Class-AB Reference Voltage Buffer for SC Circuits in Pipelined ADCs,” *Electronics*, 15(3), 547, 2026, [DOI](https://doi.org/10.3390/electronics15030547)。研究对象就是 **pipelined ADC 的 switched-capacitor reference buffer**，讨论双向充放电、Replica-drive、环路稳定性和 PSRR。论文报告的测试/仿真指标与工艺背景必须保留为**该论文条件**，不要直接当作 28 nm、1 V 方案的可实现目标。

![Zeng et al. 2026: pipeline ADC MDAC schematic, official Fig.1 (online)](https://www.mdpi.com/electronics/electronics-15-00547/article_deploy/html/images/electronics-15-00547-g001.png)

*论文配图 A：Zeng et al., Electronics 2026, Fig. 1，SC-MDAC 的参考驱动位置；来源：[开放获取原文](https://www.mdpi.com/2079-9292/15/3/547)，CC BY 4.0；需联网查看。*

![Zeng et al. 2026: Class-AB reference buffer, official Fig.11 (online)](https://www.mdpi.com/electronics/electronics-15-00547/article_deploy/html/images/electronics-15-00547-g011.png)

*论文配图 B：同文 Fig. 11，Proposed Class-AB RVB transistor schematic；[原文](https://www.mdpi.com/2079-9292/15/3/547)，CC BY 4.0。图纸请以论文标注为准，勿与前面的原创功能框图混为晶体管级实现。*

> [!warning] 跨论文比较须统一指标
> 不同论文的 settling time 可能使用不同初始阶跃、负载电容、终止精度（如 1% / 0.1% / 0.5 LSB）、温度及仿真/实测条件；不统一这些条件，数字并排并不代表有效的优劣排序。

## 5. FVF 家族：从 FVF 到 Super-FVF 与 Class-AB FVF

### 5.1 Flipped Voltage Follower（FVF）

FVF 是高速 RVB 和 fast-transient LDO 中最重要的经典结构之一。

![04_fvf_local_feedback](/images/blog/learning-notes/adc-reference-buffer/04_fvf_local_feedback.svg)

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


### 5.5 FVF 环路极性、小信号推导与稳定性（新增，重点）

![04_fvf_local_feedback](/images/blog/learning-notes/adc-reference-buffer/04_fvf_local_feedback.svg)

#### 5.5.1 如何判断负反馈？先定主 pass 管的类型

以**NMOS source follower 作为输出主器件**、输出为 source、内部控制节点 $v_g$ 为 gate、检测级为反相跨导级为例：

1. 外部 CDAC 增加抽电荷，使 $\delta v_o<0$；
2. 检测器输出 $\delta v_g=-A_s\delta v_o>0$，其中 $A_s>0$ 为幅值增益；
3. NMOS $V_{GS}$ 增大，主支路 source current 增大；
4. 输出回升，抵消原始扰动，故闭环为负反馈。

如果改用 **PMOS pass**，$\partial I_{source}/\partial V_G$ 的符号改变，对应检测级也必须满足负反馈极性；不能机械照搬 “VOUT↓ → VX↑” 的链条。传统 FVF、STC-LDO、cascode FVF 在晶体管堆叠、参考输入位置与 gate bias 上存在差别，请对每张原理图重新做极性判断。

#### 5.5.2 用输出端注入 $i_t$ 推导 $Z_{out}$

![13_fvf_small_signal](/images/blog/learning-notes/adc-reference-buffer/13_fvf_small_signal.svg)

给出一个清晰可验证的简化模型：输出 NMOS 的 $g_{mp},g_{mb},g_{dsp}$，负载等效电导 $g_L$；将 sense stage 的增益写成 $\delta v_g=-A_s\delta v_o$（反相信号路径，$A_s>0$）。以 $i_t$ 为注入输出节点的测试电流，忽略寄生电容时：

$$
i_t=\left[g_L+g_{dsp}+g_{mp}+g_{mb}+g_{mp}A_s\right]v_o.
$$

因此：

$$
\boxed{Z_{out,FVF}(0)\simeq \frac{1}{g_L+g_{dsp}+g_{mb}+g_{mp}(1+A_s)}}.
$$

若 $A_s\gg 1$ 且 $g_{mp}A_s$ 支配，可进一步写为：

$$
Z_{out,FVF}(0)\approx\frac{1}{g_{mp}A_s}.
$$

若检测级满足 $A_s\approx g_{ms}r_X$，则：

$$
\boxed{Z_{out,FVF}\sim\frac{1}{g_{mp}g_{ms}r_X}}.
$$

这是**特定简化拓扑和工作区假设下的数量级关系**，并非所有 FVF 的普适精确公式。考虑器件 $r_o$、体效应、输出电容、内节点耦合、辅助支路，必须重新列 KCL；不要只凭公式判断带宽或 PSRR。

#### 5.5.3 环路增益和局部稳定性

把断开 local loop 以后输出阻抗记为 $Z_0(s)$，局部反馈从 $v_o$ 经传感器到主器件控制 gate 的传递为 $A_s(s)$，在近似条件下有：

$$
T_{local}(s)\approx A_s(s)g_{mp}Z_0(s),\qquad
Z_{out,CL}(s)\approx\frac{Z_0(s)}{1+T_{local}(s)}.
$$

该传函包含两个常见节点：

- **内部节点 $X$（输出管 gate / sensor 输出）**：$\omega_X\approx 1/(R_X C_{X,eff})$，其中 $C_{X,eff}$ 可能包含巨大的 pass gate 电容。
- **输出节点 $V_o$**：断环时 $\omega_O\approx1/(R_{O,OL}C_{load})$，闭环阻抗降低会改变闭环极点，不能将闭环 $R_{out}$ 代入开环环路极点公式。

局部反馈虽然可以降低低频输出阻抗，但也可能把 UGF 推向次级极点，使 PM 下降；同时 $r_X$、$g_m$ 和输出端负载随 PVT/电流变化。**小信号 STB 只是必要条件，不能替代真实 CDAC 大信号切换下的稳定性检查。**

#### 5.5.4 多环 FVF 的外环与内环如何分工？

- **Fast local loop**：对大电荷阶跃产生快速电流修正，低/中频 $Z_{out}$ 更低。
- **High-gain global EA**：锁定 DC VREF、提高 LF load/line regulation、压制慢变化与一定频段的 supply noise。
- **Auxiliary loop / Class-AB**：提高 source/sink 峰值能力、补偿某些频段的不足，但也可能引入额外极点和环路互扰。

> **重要**：RVB 不等于 LDO。针对 reference load，既要看局部环又要看瞬态 *specific bit-cycle settling*；仅有 LDO load-step 的峰值误差不能证明满足 ADC 静态 INL 或动态 SFDR。

相关阅读：

- Carvajal *et al.*, 2005，原始 FVF cell 教程，[DOI](https://doi.org/10.1109/TCSI.2005.851387)。
- Man *et al.*, 2008，FVF / STC-LDO 全负载稳定性，[DOI](https://doi.org/10.1109/TCSI.2008.916568)。
- Y. Zeng *et al.*, ISCAS 2022，直接以 FVF-LDO 作为 SAR ADC RVB、加入辅助环，[DOI](https://doi.org/10.1109/ISCAS48785.2022.9937923)。

![FVF OCL-LDO with push-pull buffer — source schematic online](https://www.mdpi.com/electronics/electronics-12-01285/article_deploy/html/images/electronics-12-01285-g002.png)

*论文配图 C：Y. Li et al., Electronics 2023, Fig. 2；[原文与 CC BY 4.0 归属](https://www.mdpi.com/2079-9292/12/6/1285)。这是一幅 **FVF OCL-LDO** 图，不是针对 SAR CDAC 专门验证的 RVB。*

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


### 6.5 外接 C 与 Capless 的主极点、补偿和真实网络阻抗（新增）

![08_cap_vs_capless_poles](/images/blog/learning-notes/adc-reference-buffer/08_cap_vs_capless_poles.svg)

#### 6.5.1 传统外接大 $C_{OUT}$ 的 LDO / RVB

传统输出电容主导补偿结构，经常设计为：

$$
\omega_{p,out}\simeq\frac{1}{(r_{o,pass}\parallel R_L) C_{OUT}},
\quad
\omega_{p,g}\simeq \frac{1}{R_{EA,out}C_{g,eff}},
\quad
\omega_{z,ESR}\simeq\frac{1}{R_{ESR}C_{OUT}}.
$$

大 $C_{OUT}$ 使输出极点变低，成为 dominant pole；输出电容 ESR 还能形成零点帮助补偿。**上式中的输出电阻用于断环/开环极点建模，不能用全局反馈闭合后的测量 $R_{out,CL}$ 代替。**

#### 6.5.2 OCL/Capless 不是“完全零电容”

去掉 µF 级外接电容后仍有 $C_{parasitic}$、片上 decap、可能的内部 Miller $C_C$。常见的一条设计路线是：**内部高阻节点（EA 输出/pass gate）通过 Miller、DFC、buffer compensation 建立主极点**；不依赖输出 ESR zero。

然而另一个广泛采用的路线是 **FVF/SSF/multi-loop + pole pushing**，通过降低内部节点阻抗，将内部非主极点推到高频，继续用输出极点作为 dominant pole。因此：

| 设计路线 | 典型主极点 | 条件与代价 |
|---|---|---|
| External large-$C$ conventional | $V_{OUT}$ | 依赖大负载电容，ESR 影响稳定性 |
| Capless + internal Miller / DFC | 内部高阻补偿节点 | 依赖人工补偿与负载扫描 |
| Capless + FVF / E-SSF / output pole dominant | $V_{OUT}$ | 将内部寄生极点推高，通常需要局部高速环路 |

![Lee et al. 2022: Direct-feedback FVF LDO transistor schematic (online)](https://www.mdpi.com/sensors/sensors-22-09672/article_deploy/html/images/sensors-22-09672-g001.png)

*论文配图 D：Lee et al., Sensors 2022, Fig. 1；[来源、CC BY 4.0](https://www.mdpi.com/1424-8220/22/24/9672)。用于研究多环 FVF 的晶体管构成、极点配置与 PSRR；不是 ADC RVB 的直接实验结果。*

**出处**：Leung & Mok, JSSC 2003（[DOI](https://doi.org/10.1109/JSSC.2003.817256)）；Milliken *et al.*, TCAS-I 2007（[DOI](https://doi.org/10.1109/TCSI.2007.902615)）；Y. Lu *et al.*, TCAS-I 2015（[DOI](https://doi.org/10.1109/TCSI.2014.2380644)），其中最后一篇明确采用输出极点主导、内部极点上推；Y. Lu *et al.*, Electronics Letters 2016（[DOI](https://doi.org/10.1049/el.2016.1719)）亦采用 E-SSF 进行同类极点工程。

#### 6.5.3 为什么输出端的“合理容量”比绝对 Capless 更有意义？

对 SAR/MDAC，CDEC 是能量/电荷缓冲单元，不宜一味追求 0 pF：

- $C_{DEC}$ 太小：初始 $\Delta V\approx\Delta Q/C$ 大，要求极高的瞬时 active source/sink；
- $C_{DEC}$ 太大：面积增加，上电时间增长，输出极点改变，可能引起环路或互连 RLC peaking；
- **RVB + 近端 CDEC + reference metal bus** 是联合优化问题，决策标准为 *每次 comparator latch 前的误差与最终 ENOB/SFDR*。

进一步，片上差分参考不能简单照搬 LDO PSRR：可把供电到 $VREFP, VREFN$ 的传函 $H_{p,supply},H_{n,supply}$ 联合计算差模/共模供电敏感度。

> [!tip] 幅相扫描需要区分 local / global
> 在 Virtuoso/Spectre `stb` 中，不能随意在两条耦合环路都插同一个 probe 而认为测到两个独立的环路。应先做 loop identification：定义 local loop、global loop 的断点与运行条件，检查 probe 插入后工作点/加载是否不变，再用 transient + output impedance 对结论交叉验证。

## 7. 多通道与 TI-ADC：Hierarchical、Replica 与 Per-Channel RVB

### 7.1 Global + Local / Hierarchical RVB

![05_hierarchical_reference_distribution](/images/blog/learning-notes/adc-reference-buffer/05_hierarchical_reference_distribution.svg)

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


### 7.3 20 GS/s、32 路 TI-ADC 的参考分配案例（新增）

![05_hierarchical_reference_distribution](/images/blog/learning-notes/adc-reference-buffer/05_hierarchical_reference_distribution.svg)

对 20 GS/s、12-bit、32 路子 ADC（每路 625 MS/s）的层次化交织系统，可把 RVB 作为与 Clock/IBF/THA 同级的重要系统网络考虑。以下为**设计推导与备选方案**，并非某篇论文直接验证了这张图。

#### 7.3.1 为什么 32 路直接共用 reference rail 风险大？

共享参考总线的小信号模型为：

$$
\delta v_{ref,shared}(s)\simeq-Z_{bus}(s)\sum_{k=1}^{32}i_{ref,k}(s).
$$

不同通道的 CDAC 在各自 conversion phase 产生脉冲电流；总线阻抗与回流路径导致的扰动可以让某通道受另一个通道的输入码型影响。同步同时切换更考验 peak current，错相切换则可能引入周期性的参考纹波与 channel-dependent modulation。

#### 7.3.2 三种实现的权衡

| 方案 | 优势 | 主要风险 | 建议验证 |
|---|---|---|---|
| 共享单个强 RVB + 参考总线 | DC 一致性好，电路简单 | 跨通道耦合、远端 droop、总线 IR/L | 同时和错相切换、最远通道、RLC 频响 |
| Global precision + per-group local RVB | 控制共模/平均值，隔离局部瞬态 | Local mismatch、总线与 local loop 互扰 | 加载真实 CDAC 的多环 STB、PVT/MC |
| Per-channel RVB + local CDEC | 最短局部电流回路、良好通道隔离 | 功耗/面积、32 路 DC matching | $\Delta V_{REF,k}$ 与 channel spur、校准前后 |

对于 4×2×4 的物理分组，建议至少比较 **全共享**、**每 4 路一组**和**每 8 路一组**三级模型，目标是量化面积/电流/失真而非提前拍板。若 VREFP、VREFN、VCM 各需独立驱动，还要把电容和静态功耗按 rail × group 核算。

#### 7.3.3 验证中尤其要防止两类误判

- 某个 VREF rail 在静态或正弦输入下很稳，不等于在**满幅码型 + 32 通道错相**条件下很稳。
- 每通道独立 local buffer 不自动带来更高 SFDR：其 DC 增益/offset/噪声与 PVT mismatch 可能形成交织 spur，因此隔离与匹配必须一起优化。

相关背景：L. Ricci *et al.*, VLSI 2023, “A 2GS/s 11b 8x Interleaved ADC with 9.2 ENOB and 69.9dB SFDR in 28nm CMOS,” [DOI](https://doi.org/10.23919/VLSITechnologyandCir57934.2023.10185370)。该论文的 interleaving ADC 身份已核实；**原笔记提到的 ‘voltage-mirrored FVF’ 具体实现尚需对照论文原图确认**，不应单凭题名引用为该技术的证据。

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


### 8.6 按 CDAC 时序构建可执行的验证计划（新增）

![12_simulation_matrix](/images/blog/learning-notes/adc-reference-buffer/12_simulation_matrix.svg)

#### Phase 0：用行为电流源抽象 CDAC

1. 由 CDAC 行为模型导出 $i_{VREFP}(t),i_{VREFN}(t),i_{VCM}(t)$，同时保存 bit 决策时刻。
2. 用理想参考源供电运行一次，得到 reference current baseline。
3. 把这些电流波形回放到 RVB+reference network，扫 CDEC/走线 RC/LR，用最少晶体管仿真定位需求。

#### Phase 1：RVB 自身闭环与驱动

| 仿真 | 激励/配置 | 观察量 |
|---|---|---|
| DC + corners | $V_{IN},VREF,I_{load}$ 扫描 | Headroom、静态偏差、bias current |
| `stb` global loop | 固定各 local loop 的闭环状态 | Loop gain、UGF、PM/GM |
| `stb` local loop | 保留全局耦合的合理边界条件 | $T_{local}$、寄生低频极点 |
| AC `Zout` | 输出注入 AC 电流 | $|Z_{REF}(f)|$ 与 peaking |
| AC PSRR | 在 AVDD 注入小信号 | P/N 两端供电传递、差模/共模 |
| AC noise | 依噪声源建模 | $e_{n,ref}(f)$、指定带宽积分 |
| Transient ±step | 分别抽/灌等量电荷 | $I_{source,pk}$ / $I_{sink,pk}$、恢复时间 |

#### Phase 2：真实两级 pipeline-SAR 联合仿真

- 第一阶段 **5-bit CDAC**：重点量化 MSB、电容 split、冗余比较与 MDAC 相位的 reference interaction。
- 第二阶段 **8-bit + 冗余**：重点看更短 bit interval 中 reference error 的积累、输入幅度依赖性。
- 将 $VREFP/VREFN/VCM$ 的每次 decision-pre-latch 误差与数字输出码值、ADC FFT spur 对齐，而不是仅用 reference average ripple 判定。
- 比较 ideal VREF / real RVB / real RVB+PEX 三套结果，以差分方式找出 reference-buffer-induced SNDR、SFDR 退化。

#### Phase 3：PEX/EM 边界

- 对短 local net 可以先用 RC PEX；对长高频 reference trunk 加入高频寄生、回流路径与可能的串联电感。
- 检查片上 MOSCAP/MIMCAP ESR/ESL 与高频阻抗最低点是否落在 CDAC current spectrum 附近。
- 版图后尤其检查 REFP/REFN 对称性、return path、各 channel CDEC 的距离和公共电源线耦合。

> [!important] 交付条件建议
> 每个方案至少输出：$I_Q$、active area、CDEC 面积、$|ZREF(f)|$、PM(global/local)、$\Delta V_{REFP/REFN}$、全码型 settling percentile / worst case、ADC-level SNDR/SFDR 以及 PVT/MC。**不要把未做过联合仿真的指标称为 ADC 实际性能。**

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


### 9.4 代表性文献与进一步阅读（更新：核验 DOI 和原始出处）

![14_rvb_reading_map](/images/blog/learning-notes/adc-reference-buffer/14_rvb_reading_map.svg)

> [!info] 阅读与核验规则
> **A 类**：直接涉及 SAR / Pipeline ADC reference error 或 RVB；**B 类**：FVF/LDO/Capless 方法论文，迁移到 RVB 需要重新验证 CDAC 负载；**C 类**：商用 ADC reference 应用笔记。已尽量补全可核验 DOI；不把 LDO 通用论文误称为已在 ADC 中验证的 Reference Buffer。

#### A. ADC RVB / Reference Error：优先阅读

| 编号 | 原始文献 | 看点 | DOI / 链接 |
|---|---|---|---|
| A1 | C.-H. Chan *et al.*, “60-dB SNDR 100-MS/s SAR ADCs With Threshold Reconfigurable Reference Error Calibration,” **JSSC**, 2017 | Reference error、门限重构与校准 | [10.1109/JSSC.2017.2728784](https://doi.org/10.1109/JSSC.2017.2728784) |
| A2 | C. Li, C.-H. Chan, Y. Zhu, R. P. Martins, “Analysis of Reference Error in High-Speed SAR ADCs With Capacitive DAC,” **TCAS-I**, 66(1), 82–93, 2019 | **Reference network 理论模型必读** | [10.1109/TCSI.2018.2861835](https://doi.org/10.1109/TCSI.2018.2861835) |
| A3 | H. Ghaedrahmati, J. Xue, J. Jin, “A 10-bit 160 MS/s SAR ADC with Fast-Response Reference Voltage Buffer,” **ICSICT**, 2018 | 快速 RVB + ADC 整体协同 | [10.1109/ICSICT.2018.8565690](https://doi.org/10.1109/ICSICT.2018.8565690) |
| A4 | Y. Ni *et al.*, “A Reference Buffer with High-Efficiency for High-Speed and High-Precision Switched-Capacitor ADCs,” **ICCT**, 2018 | 功率效率与电容负载 | [10.1109/ICCT.2018.8599906](https://doi.org/10.1109/ICCT.2018.8599906) |
| A5 | Y. Zeng, C.-H. Chan, Y. Zhu, R. P. Martins, “An Auxiliary-Loop-Enhanced Fast-Transient FVF LDO as Reference Buffer of a SAR ADC,” **ISCAS**, 2022 | FVF、辅助环、SAR RVB | [10.1109/ISCAS48785.2022.9937923](https://doi.org/10.1109/ISCAS48785.2022.9937923) |
| A6 | I. Kim, Y. Qin, “A Fully Integrated FVF Based Low-Noise Voltage Buffer for ADC Reference,” **ICSICT**, 2024 | FVF reference noise / 全片上集成 | [10.1109/ICSICT62049.2024.10831500](https://doi.org/10.1109/ICSICT62049.2024.10831500) |
| A7 | L. Zeng *et al.*, “A Class-AB Reference Voltage Buffer for SC Circuits in Pipelined ADCs,” **Electronics**, 15(3):547, 2026 | **Class-AB 双向驱动、环路、PSRR，带开放图纸** | [10.3390/electronics15030547](https://doi.org/10.3390/electronics15030547) |
| A8 | L. Ricci *et al.*, “A 2GS/s 11b 8x Interleaved ADC with 9.2 ENOB and 69.9dB SFDR in 28nm CMOS,” **VLSI**, 2023 | TI-ADC 系统背景；请先核对其 RVB 原理图 | [10.23919/VLSITechnologyandCir57934.2023.10185370](https://doi.org/10.23919/VLSITechnologyandCir57934.2023.10185370) |
| A9 | “A power-efficient reference buffer with wide swing for switched-capacitor ADC,” **Microelectronics Journal**, 46(5), 410–414, 2015 | Level-shifter-assisted wide-swing RVB | [10.1016/j.mejo.2015.03.005](https://doi.org/10.1016/j.mejo.2015.03.005) |

#### B. FVF / LDO / compensation：基础到进阶

| 编号 | 原始文献 | 读什么 | DOI / 链接 |
|---|---|---|---|
| B1 | G. A. Rincón-Mora, P. E. Allen, “A Low-Voltage, Low Quiescent Current, Low Drop-Out Regulator,” **JSSC**, 33(1), 36–44, 1998 | LDO 静态功耗/驱动/频率响应 | [10.1109/4.654935](https://doi.org/10.1109/4.654935) |
| B2 | G. A. Rincón-Mora, P. E. Allen, “Optimized Frequency-Shaping Circuit Topologies for LDO's,” **TCAS-II**, 45(6), 703–708, 1998 | 传统 LDO 补偿 | [10.1109/82.686689](https://doi.org/10.1109/82.686689) |
| B3 | K. N. Leung, P. K. T. Mok, “A Capacitor-Free CMOS Low-Dropout Regulator With Damping-Factor-Control Frequency Compensation,” **JSSC**, 38(10), 1691–1702, 2003 | DFC；内部补偿、Capless 稳定性 | [10.1109/JSSC.2003.817256](https://doi.org/10.1109/JSSC.2003.817256) |
| B4 | R. González Carvajal *et al.*, “The Flipped Voltage Follower: A Useful Cell for Low-Voltage Low-Power Circuit Design,” **TCAS-I**, 52(7), 1276–1291, 2005 | **FVF 的历史、经典晶体管级结构和推广** | [10.1109/TCSI.2005.851387](https://doi.org/10.1109/TCSI.2005.851387) |
| B5 | R. J. Milliken, J. Silva-Martínez, E. Sánchez-Sinencio, “Full On-Chip CMOS Low-Dropout Voltage Regulator,” **TCAS-I**, 54(9), 1879–1890, 2007 | Capless 全片上 LDO | [10.1109/TCSI.2007.902615](https://doi.org/10.1109/TCSI.2007.902615) |
| B6 | T. Y. Man *et al.*, “Development of Single-Transistor-Control LDO Based on Flipped Voltage Follower for SoC,” **TCAS-I**, 55(5), 1392–1401, 2008 | FVF 反馈、ESR/负载/无外接 C 稳定性 | [10.1109/TCSI.2008.916568](https://doi.org/10.1109/TCSI.2008.916568) |
| B7 | Y. Lu *et al.*, “A Fully-Integrated Low-Dropout Regulator With Full-Spectrum Power Supply Rejection,” **TCAS-I**, 62(3), 707–716, 2015 | Tri-loop；**输出极点主导的 fully integrated LDO** | [10.1109/TCSI.2014.2380644](https://doi.org/10.1109/TCSI.2014.2380644) |
| B8 | Y. Lu *et al.*, “A 312 ps response-time LDO with enhanced super source follower in 28 nm CMOS,” **Electronics Letters**, 52(16), 1368–1370, 2016 | E-SSF，输出 pole，28 nm | [10.1049/el.2016.1719](https://doi.org/10.1049/el.2016.1719) |
| B9 | J.-H. Lee, M.-K. Lee, J.-D. Park, “A Direct Feedback FVF LDO for High Precision FMCW Radar Sensors in 65-nm CMOS Technology,” **Sensors**, 22(24), 9672, 2022 | 直接反馈、多环稳定性、PSRR | [10.3390/s22249672](https://doi.org/10.3390/s22249672) |
| B10 | Y. Li *et al.*, “A Low-Power, Fast-Transient FVF-Based Output-Capacitorless LDO with Push–Pull Buffer and Adaptive Resistance Unit,” **Electronics**, 12(6), 1285, 2023 | Push–pull gate buffer / FVF / dynamic transient | [10.3390/electronics12061285](https://doi.org/10.3390/electronics12061285) |
| B11 | Z. Shen, S. Yang, J. Liu, “Analysis and Design of Noise-Shaping SAR ADC with Capacitor Stacking and Buffering,” **Chips**, 3(4), 296–310, 2024 | SF/FVF buffer 传递、噪声与带宽的比较（NS-SAR 场景） | [10.3390/chips3040015](https://doi.org/10.3390/chips3040015) |

#### C. 实用工程资料

1. **ADI**, A. Walsh, [Voltage Reference Design for Precision Successive-Approximation ADCs](https://www.analog.com/en/resources/analog-dialogue/articles/precision-successive-approximation-adcs.html)：参考输入的双向动态电流、reservoir capacitor、参考源带宽/噪声。板级数据与片上 GS/s 不可直接套用。
2. **TI**, [Technical Review of Low Dropout Voltage Regulator Operation and Performance](https://www.ti.com/lit/pdf/slva072)：LDO 基础、压差、外接输出 C 与 ESR。
3. **ADI**, [Front-End Amplifier and RC Filter Design for a Precision SAR ADC](https://www.analog.com/en/resources/analog-dialogue/articles/front-end-amp-and-rc-filter-design.html)：输入驱动与 reference driver 是**不同**的 switched-capacitor 接口问题，避免混淆。

#### 阅读优先级

**建议顺序：B4（FVF cell）→ B6（FVF 稳定性）→ A2（reference error）→ A5（FVF-RVB）→ A7（Class-AB RVB）→ B3/B7（Capless 主极点不同策略）→ A1/A6（校准与低噪声）。**

> [!warning] 原始笔记中未核验条目处理
> “A Low Power Reference Voltage Buffer and High Density Capacitor Array for SAR ADC” (2020) 与 “Design of A Reference Buffer with Ultralow Output Resistance” (2021) 的完整作者/DOI 本次未找到足够可信的对应元数据，因此**不纳入已核验目录**。如果以后有 IEEE PDF/DOI，可再补入。2023 Ricci 的题名/DOI已验证，但具体 'voltage-mirrored FVF' 描述需依据正文确认。

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


### 9.6 论文分组、核验状态与论文配图索引（新增）

**本地原创示意图**（Obsidian 离线可显示，全部位于 `attachment/`）：

| 图号 | 资源 | 作用 |
|---|---|---|
| 01 | `01_reference_system_overview.svg` | Reference/LDO/RVB 模块定位 |
| 02 | `02_rvb_architecture_tree.svg` | RVB 多维架构树 |
| 03 | `03_charge_timescales.svg` | CDEC/快环/慢环时序分工 |
| 04 | `04_fvf_local_feedback.svg` | FVF 负反馈极性 |
| 05 | `05_hierarchical_reference_distribution.svg` | TI-ADC 分层参考网络 |
| 06 | `06_sf_ssf_fvf.svg` | SF/SSF/FVF 比较 |
| 07 | `07_classab_source_sink.svg` | Class-AB 双向驱动 |
| 08 | `08_cap_vs_capless_poles.svg` | 外接电容与 Capless 主极点 |
| 09 | `09_reference_network_impedance.svg` | RVB+RLC+CDAC 阻抗网络 |
| 10 | `10_refp_refn_common_mode.svg` | 参考差模/共模误差 |
| 11 | `11_sar_bitcycle.svg` | Bit-cycle 决策前 settling |
| 12 | `12_simulation_matrix.svg` | 仿真验证矩阵 |
| 13 | `13_fvf_small_signal.svg` | FVF 小信号环路抽象 |
| 14 | `14_rvb_reading_map.svg` | 文献阅读路线 |

**在线论文结构图**：

- [Zeng 2026 Fig. 1 (Pipeline MDAC)](https://www.mdpi.com/electronics/electronics-15-00547/article_deploy/html/images/electronics-15-00547-g001.png)、[Fig. 8 (Replica Class-AB)](https://www.mdpi.com/electronics/electronics-15-00547/article_deploy/html/images/electronics-15-00547-g008.png)、[Fig. 11 (Proposed RVB)](https://www.mdpi.com/electronics/electronics-15-00547/article_deploy/html/images/electronics-15-00547-g011.png)：[论文原文](https://www.mdpi.com/2079-9292/15/3/547)。
- [Li 2023 Fig. 2 (FVF OCL-LDO)](https://www.mdpi.com/electronics/electronics-12-01285/article_deploy/html/images/electronics-12-01285-g002.png)：[论文原文](https://www.mdpi.com/2079-9292/12/6/1285)。
- [Lee 2022 Fig. 1 (Direct-feedback FVF LDO)](https://www.mdpi.com/sensors/sensors-22-09672/article_deploy/html/images/sensors-22-09672-g001.png)：[论文原文](https://www.mdpi.com/1424-8220/22/24/9672)。
- [Shen 2024 Fig. 16 (SF/FVF buffer comparison)](https://www.mdpi.com/chips/chips-03-00015/article_deploy/html/images/chips-03-00015-g016.png)：[论文原文](https://www.mdpi.com/2674-0729/3/4/15)。

以上在线论文图均附作者/来源用于学习引用，属于各自开放获取论文附图；离线阅读请使用本地 14 张 SVG。不能把教学示意图作为论文原图，也不能将论文性能结果视作本人设计的仿真结果。