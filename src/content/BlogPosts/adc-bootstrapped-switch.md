---
title: ADC 自举开关：原理、失真机理、架构演进与设计方法
date: '2026-10-26'
excerpt: ADC 自举开关：原理、失真机理、架构演进与设计方法
tags:
- adc
- analog-ic
- sampling
- bootstrapped-switch
- ti-adc
- pipeline-sar
- cmos
---

# ADC 自举开关：原理、失真机理、架构演进与设计方法

> [!abstract] 本笔记的定位
> 面向高速、高精度 CMOS ADC 前端设计，建立从**理想采样模型 → MOS 非理想性 → 自举开关晶体管级实现 → 高频失真解析 → 架构改进 → PDK 仿真/后仿/版图 → 论文选读**的完整知识链。原始资料为《自举开关专题分享.pdf》（13 页）；新增 **1987–2026 年的经典及近期文献**。对于论文结论，尽量标明**电路仿真、后仿、芯片实测**三个不同层次。
>
> **图片使用说明**：`attachment/pXX_*.png` 均是从所提供的分享 PDF 中裁剪的研究用局部图，通常包含引用论文的电路图；版权仍归原作者或原出版方所有。`attachment/theory_*.png` 和 `attachment/schematic_*.svg` 是本笔记自行绘制的概念图，仅表达示意性模型，**不是工艺 PDK 的实测数据**。对外发表请按出版方许可重新获取原图。

## 目录

- #1 为什么 ADC 需要自举开关
- #2 自举开关的基本原理与晶体管级工作过程
- #3 采样时序：上极板、下极板与电荷注入
- #4 理论一：开关导通电阻与体效应
- #5 理论二：RC 建立时间与动态跟踪误差
- #6 理论三：寄生电容分压与自举电压误差
- #7 理论四：源漏交换、浮阱和非线性结电容
- #8 理论五：谐波失真的一阶解析推导
- #9 理论六：关断电荷注入、时钟馈通和保持误差
- #10 自举电容 Cb 的定量设计与权衡
- #11 噪声、抖动、输入带宽和可靠性
- #12 经典电路及八类改进架构
- #13 论文发展时间线与架构对照
- #14 从指标到尺寸：定量设计实例
- #15 面向 28 nm 高速 Pipeline-SAR 和 TI-ADC 的设计决策
- #16 Virtuoso/Spectre 仿真方案
- #17 版图、寄生提取与电源完整性
- #18 常见误区与设计失效案例
- #19 推荐精读路线
- #20 参考文献：经典、原 PDF 与新增论文

---

## 1. 为什么 ADC 需要自举开关

**自举（bootstrapping）**的目的不是让栅压本身恒定，而是让 MOS 的**栅源电压 $V_{GS}$ 尽量与输入信号无关**。对普通 NMOS 采样管，如果栅极直接驱动到 $V_{DD}$，则输入升高时 $V_{GS}=V_{DD}-V_{IN}$ 减小，导通电阻上升，导致输入相关的有限建立误差；关断时沟道电荷也随 $V_{IN}$ 改变。[R01,R02,R04]

理想自举追踪期满足

$$
V_G(t)=V_{IN}(t)+V_B, \qquad V_B\approx V_{DD},
$$

因此

$$
V_{GS}(t)=V_G(t)-V_S(t)\approx V_{DD}.
$$

若同时保持 $V_{TH}$、迁移率、寄生电容不变，则 $R_{ON}$ 近似为常数。但真实 MOS 的**体效应、浮动节点寄生、驱动滞后、源漏交换、漏结非线性、瞬态电荷再分配**依然会引入失真，不能把“恒定 $V_{GS}$”等同于“恒定 $R_{ON}$”。2025 年 Ma 等的系统分析正是建立在这些二阶因素之上。[R12]

![自行绘制的自举采样原理示意](/images/blog/learning-notes/adc-bootstrapped-switch/schematic_bootstrap_principle.svg)

*图 1：自绘概念图。预充的 $C_B$ 在 track 期间使栅极随输入信号抬升；实际电路另需复位、关断、隔离以及可靠性保护。*

![源 PDF：自举开关理想结构及实现](/images/blog/learning-notes/adc-bootstrapped-switch/p02_basic_bootstrap.png)

*图 2：源 PDF 第 2 页的自举原理与一类晶体管级实现，适合与 [R04] Razavi 2021 对照阅读。*

### 1.1 NMOS、传输门和自举开关的比较

| 类型 | 优势 | 主要瓶颈 | 典型场景 |
|---|---|---|---|
| NMOS 单管、栅极固定 | 面积小、驱动简单 | $V_{GS}$ 强烈随输入变化、体效应 | 低精度或小信号摆幅 |
| CMOS transmission gate | NMOS/PMOS 导通互补 | 两管 $R_{ON}$ 曲线不完全互补、寄生较大 | 中低速 SC、常规采样 |
| NMOS 自举 | $V_{GS}$ 近似恒定、低电源下仍可获得过驱动 | 自举节点寄生、时序、击穿风险 | 高速 SAR/Pipeline/TI-ADC |
| 互补自举 | 进一步降低/平坦化 $R_{ON}$ | 双驱动网络复杂、功耗/电容增加 | 高线性度、中速场景 [R15,R17] |
| 浮阱/多路径自举 | 抑制体效应、将非线性负载移出主路径 | 隔离与时序更复杂，DNW 和 PDK 限制 | GHz 级高 SFDR 前端 [R07,R08,R10,R13] |

> [!important] 三个必须分开的对象
> **Bootstrapped switch**：实现采样管稳定导通；**Track-and-hold (T/H 或 THA)**：包含采样、保持及可能的缓冲；**ADC 整机**：还受到输入缓冲、采样时钟 jitter、CDAC、比较器、参考源和交织失配影响。论文报告的 ADC SFDR/SNDR **不能直接当作自举开关的独立性能**。

## 2. 自举开关的基本原理与晶体管级工作过程

### 2.1 两相工作

**保持/复位相（hold/reset）**：主采样管 $M_S$ 关闭，栅极被可靠拉低；预充支路把 $C_B$ 充到接近 $V_{DD}$。**采样/跟踪相（track）**：先隔离预充路径，再把电容一端连接到输入 $V_{IN}$，另一端连接 $M_S$ 栅极，使栅压升至约 $V_{IN}+V_{DD}$。实际顺序包含多个开关的非交叠和延迟，不能假定同时理想切换。[R04]

使用 MOS 实现时，任何一个节点的浮空、泄漏、寄生耦合都会直接转化成 $V_{GS}$ 误差。高速情况下，**进入 track 的前几个皮秒/几十皮秒**往往决定有效采样时间，所以比较不同方案时应同时比较：$t_{start}$、$t_{rise,VG}$、$V_{GS,flat}$、$R_{ON}(t)$，而不只看稳态 $V_G$。

### 2.2 基本晶体管级调参顺序（对应源 PDF 第 6 页）

![源 PDF：晶体管级自举电路](/images/blog/learning-notes/adc-bootstrapped-switch/p06_transistor_schematic.png)

*图 3：原 PDF 第 6 页，辅助器件、预充路径与关断路径的具体连线以该页实际原图为准；不同文献 M1/M2 命名可能不相同。*

1. **主采样开关**：以 $R_{ON}$、动态跟踪误差、采样热噪声和输入负载共同决定初始 $W/L$；再检查 $Q_{inj}$ 及 $C_{gd}, C_{db}$ 是否因宽度增大而恶化。
2. **预充网络**：保证最短 hold 相、最差 PVT 下 $C_B$ 充分恢复到目标电压；不仅看充电时间常数，还看前一个采样输入对下一拍的 memory effect。
3. **track 拉高路径**：优化驱动关键门栅的临界链；特别关注阱结寄生和栅压上升沿，而不是盲目放大所有器件。
4. **关断/拉低路径**：确保 $M_S$ 被迅速且可靠地关闭，并控制 feedthrough 与底板开关关断次序。
5. **器件体端、深 N 阱和氧化层应力**：根据所用 PDK 的 junction、MOS reliability 和 ESD 规则逐点检查；不能把某篇论文中的体端接法直接移植到另一工艺。

## 3. 采样时序：上极板、下极板与电荷注入

![源 PDF：采样拓扑与沟道电荷](/images/blog/learning-notes/adc-bootstrapped-switch/p03_top_bottom_sampling.png)

*图 4：源 PDF 第 3 页。注意“上/下极板采样”在不同 SAR/CDAC 论文中的命名和参照节点可能不同，分析时须画出真实电容两端和开关关闭顺序。*

开关沟道电荷的一阶模型：

$$
Q_{ch}\simeq -WLC_{ox}(V_{GS}-V_{TH}),\qquad \Delta V_{s}\simeq \eta\frac{Q_{ch}}{C_S+C_{par}},
$$

其中 $\eta$ 是流向保持节点的分配比例，随关断速度、两端阻抗、波形以及电路结构变化，**不是恒定的 1/2**。若 $Q_{ch}$ 随 $V_{IN}$ 变化，采样误差就是失真；如只是固定的注入量，主要表现为 offset，可经差分或校准降低但未必消失。[R01,R03]

**Bottom-plate sampling 的核心不是“永远精度更高”**，而是合理选择断开次序，使敏感采样节点被冻结后，其他开关的电荷更多注入到低阻抗节点，从而减小信号相关误差。这需要与 SAR CDAC 翻转、共模以及比较器采样架构一起看。

- 源 PDF 将上极板与下极板概括为“前者 8–10 bit、后者 12–16 bit”，**只适合经验性说明，不是架构的理论精度上限**。
- 对全差分采样，理想对称使偶次谐波抵消，但偏置、走线不对称、时序偏差会重新产生 HD2。
- 差分采样的 $C_S$ 与共模控制必须按**每一侧物理电容**定义，不能混淆“差分等效电容”与“单端负载”。

## 4. 理论一：开关导通电阻与体效应

### 4.1 三极区近似

在强反型、长沟道、$|V_{DS}|$ 较小时，

$$
I_D\approx \mu_n C_{ox}\frac WL\left[(V_{GS}-V_{TH})V_{DS}-\frac{V_{DS}^2}{2}\right],
$$

$$
R_{ON}\approx \left[\mu_n C_{ox}\frac WL(V_{GS}-V_{TH})\right]^{-1}.
$$

这是**定方向估算式**，不是 28 nm BSIM 模型替代品。速度饱和、DIBL、迁移率退化、沟道长度调制、源漏不对称与器件寄生需要靠 PDK 仿真给出。

### 4.2 自举后为何仍非线性

若 NMOS 体端保持地电位，源跟随 $V_{IN}$：

$$
V_{TH}(V_{SB})=V_{TH0}+\gamma\left(\sqrt{2\phi_F+V_{SB}}-\sqrt{2\phi_F}\right).
$$

即使 $V_{GS}\approx V_{DD}$，也有

$$
R_{ON}(V_{IN})\approx\frac{1}{\beta\{V_{DD}-V_{TH}(V_{IN})\}},\quad \beta=\mu_n C_{ox}W/L.
$$

随着输入变化，$V_{TH}$ 仍变化；source/drain 角色随瞬态电流、采样电容残余电压切换，更增强非对称性。解决思路包括：允许时将 body/well 跟随适当信号、使用对称版图/适当器件、引入互补通道或校正寄生负载，**但体端不能任意接输入：必须先检查井结的正反偏和 PDK 限值**。

![自行推导的示意性 Ron 曲线](/images/blog/learning-notes/adc-bootstrapped-switch/theory_ron_vs_vin.png)

*图 5：自绘、非 PDK 数据，仅用长沟道模型示意“普通开关 → 理想自举 → 理想自举并减小体效应”的改善趋势。横纵轴曲线不可用于尺寸签核。*

## 5. 理论二：RC 建立时间与动态跟踪误差

### 5.1 阶跃建立（初步定尺寸）

对于一阶模型 $R_{ON}$、$C_S$：

$$
V_O(t)=V_I\left(1-e^{-t/(R_{ON}C_S)}\right),\qquad \epsilon_{step}=e^{-T_{track}/(R_{ON}C_S)}.
$$

对 $N$ bit，若**单次最差满量程阶跃**要求误差小于 $0.5$ LSB：

$$
\epsilon_{step} < \frac{1}{2^{N+1}},\qquad \boxed{R_{ON}\lesssim \frac{T_{track}}{C_S(N+1)\ln2}}.
$$

这是便于定尺寸的**保守近似**：忽略了输入源阻抗、金属 RC、非线性 $R_{ON}(t)$、可用采样窗的死区、自举启动延迟及多极点。若已给其他误差预留 budget，还应收紧界限。

![源 PDF：指数建立公式](/images/blog/learning-notes/adc-bootstrapped-switch/p05_settling_model.png)

*图 6：原 PDF 第 5 页所用的 14-bit、$C_S=1.6$ pF、$T_{track}\simeq200$ ps、$R_{ON}<12\,\Omega$ 的估算。注意其脉冲时间是特定示例，不可直接用于任意 ADC。*

![自绘：RC 常数和 14 bit 半 LSB 阶跃准则](/images/blog/learning-notes/adc-bootstrapped-switch/theory_settling.png)

*图 7：用一阶指数建立模型生成的理论曲线；这里 $\tau=RC$。*

### 5.2 正弦跟踪误差（更能解释高频 SFDR）

在 $R$、$C$ 暂时假定恒定的线性情形：

$$
H(j\omega)=\frac{1}{1+j\omega RC},\quad \left|H\right|=\frac{1}{\sqrt{1+(\omega RC)^2}},\quad \angle H=-\arctan(\omega RC).
$$

这造成的是**带宽衰减与相位滞后**，本身不产生谐波。真正产生失真的，是 $R(V)$、$C(V)$、开关控制时序和输入源非线性导致的时变或非线性。对于 $\omega RC\ll1$：

$$
v_o(t)\approx v_i(t)-R_{ON}(v_i)C_S\frac{dv_i(t)}{dt}.
$$

因此较高的 $f_{IN}$ 会放大与 $R_{ON}(V)$ 相关的追踪误差，即使 $f_S$ 和 $T_{track}$ 未改变；这也是低频性能好、GHz 输入 SFDR 差的常见原因。[R12]

### 5.3 对 THA 输入保持的具体含义

必须同时满足 **（a）输入连续变化时的跟踪精度**、**（b）track 开始之后有足够启动与建立时间**、**（c）hold 开始之后有效冻结并向子 ADC 提供稳定电位**。仅模拟一次 rail-to-rail step settling 远不足以证明 10 GHz 模拟带宽内的 SFDR。

## 6. 理论三：寄生电容分压与自举电压误差

![原 PDF：Ma 等寄生等效与三项主要非理想性](/images/blog/learning-notes/adc-bootstrapped-switch/p04_three_nonidealities.png)

*图 8：源 PDF 第 4 页，来自 [R12] 的研究思路：源漏交换、寄生电容分压、charge redistribution。*

### 6.1 电容分压的一阶分析

假定 $C_B$ 在 gate 与输入之间，关键 gate 节点有对交流地寄生 $C_{pg}$；忽略其他支路与初态：

$$
\Delta V_G\approx\underbrace{\frac{C_B}{C_B+C_{pg}}}_{\alpha}\Delta V_{IN}; \quad \Delta V_{GS}\approx -(1-\alpha)\Delta V_{IN}.
$$

**结论**：自举电容越大，$\alpha$ 越接近 1；但 $C_B$ 也带来时钟驱动动态功耗、面积、漏电和启动延迟。真正有效的方案常常是**先减少 $C_{pg}$**，或者把较非线性的阱结/控制支路移到辅助路径，而不只是放大 $C_B$。[R08,R10,R11,R19]

更完整的高频模型还要引入等效驱动电阻 $R_d$ 与关键栅节点的 $C_{eq}$：

$$
\alpha(s)\approx\frac{C_B}{C_B+C_{pg}}\cdot\frac{1}{1+s R_d C_{eq}},
$$

于是 $V_G$ 对 $V_{IN}$ **既有振幅误差，也有相位延迟**。以上为简化模型，真实网络含多个浮动节点和强非线性电容，需对 transistor-level netlist 做 AC/PSS/PAC 或大信号 transient 识别。

### 6.2 切换瞬间的电荷再分配

$C_B$ 在 hold 相充电完毕，切换到 track 时会与 $M_S$ gate、PMOS well、辅助控制栅等电容交换电荷。若固定总电荷，简单模型为

$$
\Delta V_G\simeq\frac{Q_{pre}}{C_B+C_{par}}-V_{expected}.
$$

这通常表现为 $V_G$ 上升沿幅值不足、过冲、振铃或随输入的初值变化。若仅测到“峰值 $V_G$ 很高”，仍不能说明 track 后期 $V_{GS}$ 平坦，或整个导通期间 $R_{ON}$ 最小。

## 7. 理论四：源漏交换、浮阱和非线性结电容

### 7.1 源漏交换（source–drain exchange）

采样管两端分别连接快速变化的输入和有记忆的采样电容。切换时 $V_{IN}-V_{OUT}$ 可能反号，MOS 的小信号“源”在实际导通动态中并非永远同一物理端。体效应 $V_{SB}$、寄生结电容、器件非对称与沟道电荷分布随之变化，因而仅在 DC sweep 下提取 $R_{ON}(V_{IN})$ 不够。[R12]

### 7.2 阱结电容的电压依赖

以反偏 PN 结近似：

$$
C_j(V_R)=\frac{C_{j0}}{(1+V_R/\Phi_j)^m}.
$$

若结电容直接加载在输入或高阻自举节点，$V_R$ 随输入变化，等效 $C(V)$ 会使输入电流中出现非线性成分。对 $q(V)=\int C(V)\,dV$，电流是

$$
i(t)=\frac{dq}{dt}=C(V)\frac{dV}{dt}.
$$

由此可知，**带宽越高，非线性结电容的电流影响通常越显著**。消除结电容，不必追求电容绝对值为零，而是改善其端点电压摆幅、线性化或让该电流不流入关键采样节点。

### 7.3 Floating well / dynamic deep N-well

![原 PDF：浮阱优化电路对比](/images/blog/learning-notes/adc-bootstrapped-switch/p07_floating_well.png)

*图 9：源 PDF 第 7 页，Zheng 等提出的寄生优化方案，参见 [R07] 及对应的 2016 年 S/H 专题 [R23]。*

基本思想：用隔离阱让采样管或关键辅助器件的 body/well 不再固定接一个对信号而言强变化的电位，借助随动/浮动使结电容变化更小，或者将结电容分隔到非关键节点。该结构在高频输入线性度方面有价值，但必须解决：

- PN 结全信号范围不能正向导通；动态 well 的电位恢复和累积电荷问题。
- DNW–Psub–Pwell 的寄生电容与噪声耦合；浮阱未必减小**总**寄生。
- PDK 对 isolated NMOS、DNW body connection、ESD/latch-up、天线及可靠性的约束。
- 极端 PVT 下阱电压是否上冲，尤其上电、关断和时钟丢失期间。

2016 年郑旭强等的 14-bit、250 MS/s IF 采样 ADC，以及 2025 年 Wang 等的动态 DNW 方案是重要对照。[R07,R19]

## 8. 理论五：谐波失真的一阶解析推导

> [!tip] 本专题最重要的理论连接
> 把“为什么 $R_{ON}$ 随输入变化会导致 HD2/HD3”真正推出来，比仅记住“Ron 要小”更有助于设计判断。

令输入正弦为 $v=A\cos\omega t$，近似展开

$$
R_{ON}(v)=R_0\left(1+a_1v+a_2v^2+\cdots\right).
$$

在 $\omega R_0C_S\ll1$、扰动很小且只有电阻非线性的情况下：

$$
e(t)=v_o-v_i\approx-R_0C_S(1+a_1v+a_2v^2)\frac{dv}{dt}.
$$

因为 $dv/dt=-A\omega\sin\omega t$，利用恒等式

$$
\cos\theta\sin\theta=\frac12\sin2\theta, \quad \cos^2\theta\sin\theta=\frac14(\sin\theta+\sin3\theta),
$$

得到**二次项造成的 2 次谐波**和**三次项造成的 3 次谐波**近似幅度：

$$
\boxed{\left|\frac{V_{HD2}}{V_1}\right|\approx\frac{|a_1|A\omega R_0C_S}{2}},
$$

$$
\boxed{\left|\frac{V_{HD3}}{V_1}\right|\approx\frac{|a_2|A^2\omega R_0C_S}{4}}.
$$

以上假设谐波远小于主波、$a_1$ 单位 $\rm V^{-1}$、$a_2$ 单位 $\rm V^{-2}$。它说明：

1. $a_1$（$R_{ON}$ 的斜率）主要产生 HD2；$a_2$（曲率）主要产生 HD3。
2. 在该**低频弱非线性模型**内，谐波幅值随输入频率 $f$ 和时间常数 $R_0C_S$ 线性增加；振幅分别与 $A$、$A^2$ 成比例。
3. 在理想全差分结构中 HD2 可抵消，但 HD3 不会因差分对称自动消失。
4. 公式不覆盖源漏交换、分压、结电容、记忆效应和 track→hold 的采样误差，这些须额外建模。[R12]

![自绘：弱非线性模型的 HD2/HD3 随输入频率趋势](/images/blog/learning-notes/adc-bootstrapped-switch/theory_harmonics_scaling.png)

*图 10：采用人为设定的 $\tau=8$ ps、$A=0.4$ V、$a_1=0.22\,\mathrm{V^{-1}}$、$a_2=0.48\,\mathrm{V^{-2}}$ 计算，只验证推导的趋势，不是 28 nm 的性能预测；当 $\omega\tau$ 不再很小时近似失效。*

### 8.1 与 Ma et al., TCAS-I 2025 的关系

Ma、Yu、Hu 在 [R12] 中把三个结构非理想因素分离，通过时域波形积分和 Chebyshev 多项式分析 $R_{ON}$ 的傅里叶分量，并以 180 nm 硅片实验验证失真模型。论文摘要报告第三谐波与 $R_{ON}$ 及 bootstrap 电容存在**二次依赖、40 dB/dec 的关系**（其变量定义与扫参条件须按正文理解）。**不要用本节的简化 $HD3\propto R_0$ 公式去推翻该结果**：两者描述的非线性机制和扫描条件并不相同。精读原文时，应记录：自变量是 $R_0$、$C_B$、$1/C_B$ 还是它们的寄生耦合函数；$HD3$ 定义是幅比还是功率比；是否保持其他变量不变。[R12]

### 8.2 非线性寄生电容如何生成谐波：从电荷守恒推导

对随电压变化的寄生电容 $C(V)=C_0+c_1V+c_2V^2+\cdots$，由 $i=dq/dt=C(V)\,dV/dt$，当 $V=A\cos\omega t$ 时：

$$
\begin{aligned} i(t)&=-\omega C_0 A\sin\omega t\\ &\quad-\frac{c_1\omega A^2}{2}\sin2\omega t\\ &\quad-\frac{c_2\omega A^3}{4}(\sin\omega t+\sin3\omega t)+\cdots. \end{aligned}
$$

**一阶 $C(V)$ 非线性产生二次谐波电流，二阶 $C(V)$ 非线性产生三次谐波电流**；但其最终对**采样电压**的谐波贡献取决于输入缓冲输出阻抗、线路传输、节点位置和保持时刻，不能把上述电流幅度直接当 ADC 的 HD2/HD3。尤其在输入缓冲非零输出阻抗、THA 输入较大结电容时，$C(V)$ 注入电流经前级阻抗形成电压畸变，是 Input Buffer 与 BS 联合设计的理论基础。[R07,R18,R19]

### 8.3 如何用实验区别不同失真源

| 扫描变量 | 若现象成立 | 更可能的主因 | 下一步实验 |
|---|---|---|---|
| $f_{IN}$ | 谐波随输入频率明显升高 | 动态 $R_{ON}$、$C_j(V)$、时序滞后 | PSS/瞬态比较 $V_{GS}$ 相位，扫 $C_B$ 与 gate drive |
| 输入幅度 $A$ | HD2 相对主波约 $\propto A$ | 一阶非线性系数 $a_1$、$c_1$ | 差分奇偶项、共模与 body 端 sweep |
| 输入幅度 $A$ | HD3 相对主波约 $\propto A^2$ | 二阶 $R(V)$ 曲率、$C(V)$ 曲率 | $R_{ON}$ 多项式拟合、结寄生比较 |
| $C_B$ | 变大先改善、后饱和或变坏 | 寄生分压与启动时延折中 | 二维扫 $C_B$ 和 driver 尺寸 |
| track 时间 | 增大后大幅改善 | 启动/建立不足或前一拍记忆 | 扫 sampling aperture、记录第 1 个和稳态周期 |
| 差分正负互换 | HD2 显著变化 | 布线、器件与时钟不对称 | 互换物理左右布线并作 PEX 差分比较 |

表中 $A$ 幂次只是 §8.1 / §8.2 的弱非线性、低频近似**诊断线索**，与多极点、频率相关 gate response、数字失配或大信号失真叠加后不应机械套用。

## 9. 理论六：关断电荷注入、时钟馈通和保持误差

### 9.1 关断电荷注入

开关关断时，沟道电荷向输入端、保持节点分配，形成 $\Delta V_{CI}$；栅源、栅漏交叠电容把时钟边沿直接耦合到输出，形成 $\Delta V_{CF}$：

$$
\Delta V_{CF}\approx\frac{C_{gd}}{C_S+C_{par}+C_{gd}}\Delta V_G.
$$

两项有时方向相反、可部分抵消，然而**固定输入、固定时序得到一次抵消不代表对全输入摆幅、PVT、频率都成立**。[R01,R03]

### 9.2 典型抑制方法

- 先切断对输入敏感的开关，再切断低阻抗节点（bottom-plate / non-overlap）。
- 合理使用 dummy switch、互补开关或 feedthrough cancellation，重点是匹配**注入到保持节点的有效电荷**，而非只匹配晶体管总宽度。
- 在不会破坏 aperture 定义的前提下优化下降沿与非交叠，过快下降沿未必最小误差。
- 将大摆幅控制信号与采样节点分隔、降低 $C_{gd}$，并考虑时钟线电容串扰。

### 9.3 保持阶段不可忽略的效应

$\Delta V_{droop}=I_{leak}T_{hold}/C_S$；还有栅漏/结漏电、charge redistribution、THA 输出缓冲 loading、回踢、kickback、保持电压的温漂、前一拍残余形成的 memory effect。对于高速多通道 ADC，track 开关不是唯一的“采样质量”瓶颈。

## 10. 自举电容 $C_B$ 的定量设计与权衡

### 10.1 不能使用简单的“$C_B>C_S$”通用公式

原 PDF 第 6 页给出 $C_B$“按经验略大于采样电容”的建议，但**这不是普遍设计定律**：$C_B$ 直接驱动的是自举门控/辅助节点的等效总电荷负载，而 $C_S$ 是输入采样负载。两者物理上不应一概比较。需基于实际结构给出初值：

$$
C_B \gg C_{gate,eff}+C_{par,boot},\quad \text{且}\quad \Delta V_{GS,allow}\gtrsim\frac{\Delta Q_{loss}}{C_B}.
$$

若需要分压比例 $\alpha\ge1-\delta$，在第 6 节最简单的模型中

$$
\boxed{C_B\ge\frac{1-\delta}{\delta}C_{pg}}.
$$

例如 $\delta=1\%$ 时需 $C_B\ge99C_{pg}$；这只是**静态电容分压**的数学界限，并不等同于整机要求或最佳设计。无 PDK 节点寄生值时不要由这个公式直接选最终 $C_B$。

### 10.2 电容增大并非单调更优

| $C_B$ 变大 | 正面 | 负面 |
|---|---|---|
| 自举节点幅值 | 受寄生分压影响通常减小 | 预充更慢、时钟充放电能量变大 |
| 高频动态性能 | 有时 $V_{GS}$ 更平坦 | 自举驱动器 $R_d C_B$ 增大，反而损失有效 track 窗 |
| 版图 | 可以选较优匹配 MIM/MOM | 面积、耦合、寄生地电容变大 |
| 可靠性 | 减少栅压跌落 | 跨电源及开关切换时的过冲和应力仍需检查 |

建议把 $C_B$ 与关键 PMOS/辅助开关尺寸做**二维扫参**，观察 $V_{GS,flat}$、$t_{50\%}$、SFDR、耗能和最大器件应力 Pareto 前沿。

## 11. 噪声、抖动、输入带宽和可靠性

### 11.1 $kT/C$ 噪声

理想充足采样的单端电容热噪声方差：

$$
\sigma_{n}^2\approx\frac{kT}{C_S},\quad \sigma_n\approx\sqrt{\frac{kT}{C_S}}.
$$

对于两侧**相互独立且各为 $C_S$ 的全差分采样**：

$$
\sigma_{n,diff}\approx\sqrt{\frac{2kT}{C_S}}.
$$

这是常见理想值，并非任意 SC 网络的通式；有限采样窗、噪声带宽、开关网络与 THA 放大器会改变结果。减小 $R_{ON}$ **不会自动降低充分建立后的 $kT/C$ 积分噪声**，主要改变建立速度与噪声带宽过程。[R04]

### 11.2 采样时钟 jitter

满幅单音且随机时序误差 RMS 为 $\sigma_t$：

$$
\boxed{SNR_{jitter}\approx -20\log_{10}(2\pi f_{IN}\sigma_t)}.
$$

对高速 TI-ADC，负责**第一次定义模拟采样时刻**的 THA 边沿直接影响输入信号 jitter；而对保持后近乎 DC 的电压进行子 ADC 采样，时钟抖动的敏感性大幅降低，但**子 ADC 时钟仍必须严格落在 THA 有效保持窗内部**。

![自行绘制：THA 和子 ADC 采样窗口关系](/images/blog/learning-notes/adc-bootstrapped-switch/schematic_sample_window.svg)

*图 11：自绘概念时序图，并非任何具体芯片的实际波形。给子 ADC 压缩 track 脉宽时必须保留 hold guard band。*

### 11.3 可靠性高于“栅压不超过电源”的直觉

自举节点 $V_G$ 可以高于 $V_{DD}$，但器件风险由每个瞬间的 $|V_{GS}|,|V_{GD}|,|V_{GB}|,|V_{DS}|$、各 PN 结正反偏、绝对最高电位、持续时间及 PDK aging 规则决定。**$V_G=V_{IN}+V_{DD}$ 并不自动意味着 MOS 安全**，尤其在电源斜坡、时钟停止、异步复位、芯片测试模式下。[R05]

## 12. 经典电路及八类改进架构

### 12.1 [A] 传统 Bootstrap：Abo/Gray → Razavi 基础分析

- **原理**：预充 $C_B$；track 将 gate 跟随输入；hold 拉低 gate。
- **适用**：作为 28 nm 中速单通道 Pipeline-SAR 的 baseline 必须首先跑通。
- **不足**：自举驱动多级串联、PMOS N-well 大寄生、body effect、启动延迟。
- **核心参考**：[R02] Abo & Gray 1999；[R04] Razavi 2021；[R05] Dessouky & Kaiser 2001（强调栅氧可靠性）。

### 12.2 [B] 浮阱/寄生优化：2016 Zheng

![源 PDF：浮阱与常规 BS 对比](/images/blog/learning-notes/adc-bootstrapped-switch/p07_floating_well.png)

抑制自举主路径非线性 junction loading；对于 IF/高频采样特别重要。源 PDF 描述 400 MHz 输入处 SFDR 改善约 8 dB，应理解为论文所报告**具体比较条件**而不是任意工艺适用的增益。完整 ADC 测量包括 250 MS/s 下 400 MHz 输入仍获得超过 84 dB SFDR。[R07,R23]

### 12.3 [C] 快速导通 / Accelerated bootstrapping：Devarajan 2017

![源 PDF：快速导通支路](/images/blog/learning-notes/adc-bootstrapped-switch/p08_fast_turnon.png)

传统驱动从时钟切换至辅助节点再到 PMOS 开关有串行延迟；增加加速支路直接控制关键 PMOS 栅极，缩短 $t_{start}$，更适合短 track 窗。原 PDF 第 8 页以 120 ps→100 ps 为论文讨论的示例，不能简单等同于同一颗 ADC 的最高采样率或所有输入频率下的保证。[R06]

**额外可读**：Zhuang 等 2021 ISCAS 的上升沿加速/降低 $R_{ON}$ [R16]；Zhu 等 2023 JSSC 38 GS/s、7-bit、22 nm FinFET 的速度增强型 Bootstrap [R14]，属于原 PDF 漏掉的**高优先级**文献。

### 12.4 [D] Dual-path：Swindlehurst 2021 JSSC

![源 PDF：双路径结构](/images/blog/learning-notes/adc-bootstrapped-switch/p09_dual_path.png)

关键动机不是简单增加两条信号输入线，而是把影响关键 bootstrap gate 的**PMOS N-well 非线性寄生**转移/隔离到辅助电路路径。原 PDF 引用约 **7:1** 的主辅尺寸/电容比例，是某个设计的具体优化点，不是数学定律；设计时仍需扫比例并看应力、启动、SFDR、面积。[R08]

### 12.5 [E] Dual-loop：Ramkaj 2020 JSSC

![源 PDF：双环路和时间波形](/images/blog/learning-notes/adc-bootstrapped-switch/p10_dual_loop.png)

引入多个相互配合的自举控制节点，使关键串联开关快速且较同步地进入强导通状态，减小动态栅压误差和部分大寄生。原 PDF 提到 $R_{ON}\approx10\,\Omega$、一定频率范围内变化小、HD2 低于 −80 dB，这些都是**该文实现及测试条件的报告数值**，需回到 Fig. 4 和实验条件核对。[R09]

### 12.6 [F] 进一步分离辅助支路：2025 ISSCC 72 GS/s

![源 PDF：改进 dual-path 和 dummy BS](/images/blog/learning-notes/adc-bootstrapped-switch/p11_improved_dual_path.png)

Zhang 等报道 **72 GS/s、9-bit TI Pipeline-SAR ADC（16 nm FinFET）**。源 PDF 总结关键点为主/辅支路更严格分离、虚拟 BS 以抑制馈通，以及较短跟踪延迟和更高 boost。其“+5.2 ps、+150 mV、+6 dB SFDR”需理解为**论文特定对比基线**；这不是独立 BS 通用指标。[R10]

### 12.7 [G] 多路径：Ding et al. 2025

![源 PDF：多路径结构](/images/blog/learning-notes/adc-bootstrapped-switch/p12_multi_path.png)

将**主信号自举、非线性寄生隔离、控制开启、快速导通**分为多条功能不同的路径，突破“大尺寸单路径承载所有需求”的矛盾。源 PDF 提到主辅约 7:1、额外控制 M5–M7 和加速 M4；论文报道的整机规格是 **14 GS/s、8-bit TI-SAR、28 nm**，应从该文完整测量/仿真条件评估各改进贡献。[R11]

### 12.8 [H] 2024–2026 新增方向：理论、栅/阱驱动、辅助电容、互补 BS

**H1. 定量失真设计指导（Ma 2025 TCAS-I）**：基于解析模型分解源漏交换、电容分压、电荷再分配，适合做**参数优先级和失真敏感度**研究。[R12]

**H2. 动态栅驱动 + 动态深 N 阱（Wang et al. 2025 Electronics Letters）**：降低关键节点寄生、用三态驱动等手段简化关键 PMOS 的寄生负担；该文**180 nm Spectre 仿真**，$f_S=80$ MHz 时 THD 达 −101.3 dB，比作者的传统方案改善约 20.7 dB，不属于 silicon-measured 结果。[R19]

**H3. 辅助电容支路（Zhou et al. 2026 ELEX）**：把非关键支路由主 bootstrap 路径转移到辅助电容上，减轻寄生电容与信号通路耦合；**55 nm 仿真**，10 MHz 采样下报告 89.86 dB SNDR、94.52 dBc SFDR。不可直接用这些数字推断 GHz 输入性能。[R20]

**H4. 加速管 + 降电荷注入（Bayazi et al. 2026 SMACD）**：22 nm FDSOI、800 mV 供电，论文的**后仿**报告相对传统方案上升时间减少约 31%，示例 74 ps，且 200 MHz–1 GHz 输入范围内等效 ENOB 约 10.2 bit；关键是对比测量定义、输入频率与采样频率。[R21]

**H5. Bootstrapped complementary switches（Qin & Cai 2023 ISCAS；Wang et al. 2024 ELEX）**：在维持 NMOS 自举的基础上利用 PMOS 并联通路减小 $R_{ON}$ 及其输入斜率，代价是双网络寄生与功耗。[R15,R17]

**H6. Feedthrough / junction capacitor cancellation（Cheng et al. 2023 ISCAS）**：从整个输入缓冲+采样链视角对非线性结电容/馈通做自抵消，对系统级前端比单独优化主采样管更有启发。[R18]

**H7. 14-bit 低功耗 ADC 中的寄生隔离（2026 Microelectronics Journal）**：5 MS/s、14-bit Pipeline-SAR、125 μW 的**硅片实测**研究强调 BS 与 $kT/C$ cancellation 协同，报告 71.5 dB SNDR、83 dB SFDR（Nyquist 输入）；论文还报告改进 BS 相比其选取的既有 dual-path 方案 SFDR 提升 8 dB。采样率与 GHz 目标相距甚远，不能直接迁移绝对指标。[R24]

**H8. 高阶校准补偿采样非线性（2026 TCAS-I）**：少量神经元的物理可解释 NN 校准对 65 nm 12-bit SAR 样片 SNDR/SFDR 有改善；属于**数字补偿路线**，不是 BS 电路结构替代，也不能覆盖未经观测的 PVT/频率范围。[R25]

## 13. 论文发展时间线与架构对照

| 年份 | 论文（详见 §20） | 方法/贡献 | 证据属性 |
|---|---|---|---|
| 1987 | Wegmann 等 [R01] | MOS charge injection 物理建模 | 理论+实验 |
| 1999 | Abo & Gray [R02] | 低压 Pipeline ADC 自举采样的重要早期实现 | 芯片 |
| 2001 | Dessouky & Kaiser [R05] | 低压可靠性、对称本地 bootstrap | 芯片 |
| 2016 | Zheng 等 [R07,R23] | floating well、寄生优化、高 IF 线性度 | 芯片 |
| 2017 | Devarajan 等 [R06] | GHz 级快速导通 bootstrap | 芯片 ADC |
| 2020 | Ramkaj 等 [R09] | dual-loop + passive sampling | 芯片 ADC |
| 2021 | Razavi [R04] | 晶体管级原理与设计步骤 | 教学/设计分析 |
| 2021 | Swindlehurst 等 [R08] | dual-path、非线性阱寄生隔离 | 芯片 ADC |
| 2023 | Zhu 等 [R14] | **38 GS/s** speed-enhanced BS | 芯片 ADC |
| 2023 | Qin & Cai [R15] | complementary bootstrapped switches | 会议论文 |
| 2023 | Cheng 等 [R18] | junction cancellation / RF 前端 | 仿真 |
| 2024 | Wang 等 [R17] | CMOS complementary BS、40 MS/s SAR | 仿真结果为主 |
| 2025 | Ma 等 [R12] | **非线性失真分析/实验验证** | 理论+硅验证 |
| 2025 | Wang 等 [R19] | 动态 gate / DNW，关键寄生抑制 | 电路仿真 |
| 2025 | Zhang 等 [R10] | 72 GS/s TI Pipeline-SAR 改进 dual-path | 芯片 ADC |
| 2025 | Ding 等 [R11] | 14 GS/s TI-SAR multi-path BS | 芯片 ADC |
| 2026 | Zhou 等 [R20] | 辅助电容路径，低寄生 | 55 nm 电路仿真 |
| 2026 | Bayazi 等 [R21] | 22 nm FD-SOI 快速上升/降低 charge injection | 后仿 |
| 2026 | 相关延伸 [R24,R25] | 寄生隔离、前端失真校准 | 论文给定条件 |

> [!note] 阅读任何论文的比较图请补全 8 个条件
> 工艺与器件类型、$V_{DD}$、$f_S$、$f_{IN}$、输入幅度/共模、$C_S$、电路或整机测量、pre-layout/post-layout/silicon。少任一项，绝对 SFDR、THD、上升时间通常**不可直接横向排序**。

## 14. 从指标到尺寸：定量设计实例

### 14.1 原 PDF 数值复核：1 GS/s、14-bit、$C_S=1.6$ pF

假定 $T_{track}=200$ ps 且要求满量程 step 残差小于 $0.5$ LSB：

$$
R_{ON,max}=\frac{200\ \mathrm{ps}}{1.6\ \mathrm{pF}\times15\ln2} \approx\boxed{12.0\ \Omega}.
$$

这和原 PDF 第 5 页 $<12\,\Omega$ 一致。**需要强调**：实际 sampler 还有输入驱动 $R_S$ 和走线电阻，如果是串联关系，则应按 $R_S+R_{route}+R_{ON}$ 控制等效时间常数，而不是把整条链的 12 Ω 都分给开关。

### 14.2 扫分辨率、可用 track 窗和 $C_S$

下面的数值均按相同 half-LSB 阶跃界限，**只作一阶目标估算**：

| $N$ | $T_{track}$ | $C_S$ | $R_{ON,max}$ |
|---:|---:|---:|---:|
| 10 bit | 200 ps | 1.6 pF | 16.4 Ω |
| 12 bit | 200 ps | 1.6 pF | 13.9 Ω |
| 14 bit | 200 ps | 1.6 pF | 12.0 Ω |
| 12 bit | 180 ps | 1.0 pF | 20.0 Ω |
| 12 bit | 180 ps | 1.6 pF | 12.5 Ω |
| 14 bit | 180 ps | 1.0 pF | 17.3 Ω |

### 14.3 容量/噪声/速度三维权衡

@300 K, $kT\approx4.14\times10^{-21}$ J。若每侧 $C_S=1.6$ pF，则

$$
\sqrt{kT/C_S}\approx50.9\ \mu\mathrm{V}_{rms};\qquad \sqrt{2kT/C_S}\approx72.0\ \mu\mathrm{V}_{rms}.
$$

对于差分满量程 $0.8\ \mathrm{V_{pp,diff}}$、12-bit，1 LSB 是 $0.8/4096\approx195.3\ \mu\mathrm{V}$，均匀量化噪声约 $56.4\ \mu\mathrm{V}_{rms}$。上述单端/差分热噪声不应跟差分 $LSB$ 随意直接相加，必须先确认具体采样等效电容、相关性、增益/衰减及噪声折算位置。若每侧独立 $C_S=1.6$ pF 的简单全差分拓扑成立，仅采样热噪声就已接近甚至超过 12-bit 量化噪声。

## 15. 面向 28 nm 高速 Pipeline-SAR 和 TI-ADC 的设计决策

### 15.1 625 MS/s 单通道 Pipeline-SAR：先校准哪个量？

对采样开关优先按照**真正的有效 track 窗和单边 CDAC 等效电容**确定 $R_{ON,max}$。$f_S=625$ MS/s 对应周期 1.6 ns，但不能把 1.6 ns 全部视作可用 track；应扣除时钟非交叠、自举启动、CDAC 配置/采样结束保护时间。设计先进行：

1. 读出 $C_{S,eff}$（包含 CDAC、连接线和必要输入电容），抽取最小 $T_{track,eff}$。
2. 用 §14 的公式给出 $R_{ON}$ 上限，再将其分配为 $R_{source}$、$R_{route}$、$R_{switch}$。
3. 以最坏输入幅度的 **$SFDR(f_{IN})$、HD2/HD3** 和 transient $V_{GS}$ 平坦度优先判定；不要只看 low-frequency SNDR。
4. 若 spur 以 HD2 为主，先检查差分不对称、bootstrap 击穿保护/阱寄生及时钟不对称；若 HD3 占优，优先扫 $R_{ON}$ 曲率、$C_B$ 与体效应补偿。
5. 使用同样采样电容/输入缓冲/时序，对比 baseline 与改进 BS；否则无法隔离性能收益。

### 15.2 20 GS/s 分层 TI-ADC：谁对 jitter 敏感？

在 THA **2.5 GHz / 子 ADC 625 MHz** 的级联场景，THA 在 track→hold 转换边沿定义高速输入采样时刻，jitter 与时偏敏感；其后子 ADC 应在 THA 的**稳定保持窗**内采样近似常值，其 jitter 对输入斜率的影响较弱。因此“THA 边沿保持优先、缩短/调整子 ADC track 脉宽”是合理思路，**但不能绕过 THA→ADC 时钟路径的 PVT 和 phase margin**。

对这种系统，BS 优先看：

- THA 输入端：GHz 级 tracking bandwidth、signal-dependent Ron、输入缓冲/ESD/封装电容、THA 栅波形与 substrate noise。
- 子 ADC 端：开关是否在 hold 窗内完全建立、是否跨入下一次 THA track、CDAC kickback 如何回注 THA 输出。
- 多路径 BS 的真实收益：若关键损失来自长距离时钟偏移，单纯增加 BS 速度仍不能代替正确的 **deskew / phase guard / track pulse shaping**。

### 15.3 当单通道 SFDR 不够时的排查顺序

`Ideal switch + real input buffer` → `real BS + ideal input buffer` → `complete front end` → `pre-layout` → `RC extracted` → `R+C with coupling` → `device+interconnect EM as necessary`。

该阶梯可判别究竟是 BS、本级 buffer、共模/驱动不足、布线不对称还是时钟分配在限制 SFDR。**不要直接把整机 SFDR 的所有损失归因于 BS**。

## 16. Virtuoso/Spectre 仿真方案

> [!success] 建议建立可复用的 Bootstrapped Switch Characterization Testbench
> `TB_BS_DC`, `TB_BS_Transient`, `TB_BS_SFDR`, `TB_BS_Noise`, `TB_BS_Stress`, `TB_BS_PEX` 六类；每类全差分与单端两套需要的测试。以下是测试方法框架，具体 spectre 选项需按版本和 PDK 建立。

### 16.1 静态与准静态 Ron

- 强制主开关处于 track 条件，扫输入共模与瞬时 $V_{IN}$；对开关施加小 $\Delta V$，计算 $R_{ON}=\Delta V/I$。
- **不要**把一个浮动 gate 的 DC operating point 当成真实自举周期的工作点；推荐用已稳定的瞬态周期固定相位测量，或 PSS 周期性工作点。
- 绘制 $R_{ON}(V_{IN},V_{CM},T,corner)$ 与 $\partial R_{ON}/\partial V_{IN}$。
- 区分输入→采样保持端的有效电阻与单只 MOS 的 $R_{DS}$。

### 16.2 瞬态（时序与节点应力）

记录：$V_{IN}$、$V_{OUT}$、$V_G$、$V_B$、关键 PMOS 的 gate/source/bulk、$V_{GS,S}$、$V_{GD,S}$、$V_{BS,S}$、boot capacitor 两端电压；提取：$t_{start}$、$t_{10\%-90\%,G}$、$T_{track,eff}$、$\Delta V_{GS,pp}$、$V_{GS,min}$、peak stress、droop 和对前一拍的记忆。

### 16.3 高频频谱与谐波

采用相干采样：$f_{IN}=k f_S/N_{FFT}$，$\gcd(k,N_{FFT})=1$（或在合理窗函数下非相干采样），**必须匹配采样系统的实际有效采样率**。扫 $f_{IN}$ 至目标模拟输入带宽上限（允许输入信号超过 Nyquist，注意 alias 谐波定位）。输出 $SNDR, SFDR, HD2, HD3, HD5, THD$，区分单次运行和 Monte Carlo 分布。

小心：频谱采样对象必须是**hold 末或定义的采样点**，不是连 track 与 hold 全部数据直接 FFT；功率估计时避免因使用 alias 而错误识别谐波，时钟馈通 spur 也不能简单归到 HD2。

### 16.4 噪声与 PVT

- transient noise：用于开关热噪声、charge injection jitter、有限采样窗产生的噪声影响。
- PSS/Pnoise：周期性开关电路的周期工作点和噪声折叠，**须确认仿真支持的非线性开关、sidebands 与提取节点**。
- Corner：FF/SS/FS/SF、供电最小/最大、低温/高温、工艺电容变化；统计 Monte Carlo 要同时包含 MOS mismatch、MIM mismatch 及采样时钟随机因素（按模型能力）。
- 低 VDD 最小驱动速度与高 VDD 可靠性最恶劣点可能不在同一 corner。

### 16.5 针对失真源的 A/B 开关实验

| 实验 | 对照条件 | 目的 |
|---|---|---|
| A | 理想主开关 vs 真实 BS | 剥离采样开关总误差 |
| B | 固定 bulk vs 隔离/浮阱 | 体效应/结寄生敏感度 |
| C | 改变 $C_B$，其他不动 | 电容分压/驱动速度折中 |
| D | 改 PMOS / DNW 寄生主导节点 | 关键非线性负载所在 |
| E | 改快开支路尺寸、保持开关尺寸 | $t_{start}$ 与 $V_{GS,flat}$ |
| F | 相同元件面积、比较 single/dual/multi path | 架构贡献而不是堆资源 |
| G | 完整 RC、仅 C、仅 R、coupling | 哪类 PEX 主导 spur |
| H | $f_{IN}$ 扫频并记录 HD2/HD3 | 验证 §8 的奇偶谐波特征 |

## 17. 版图、寄生提取与电源完整性

### 17.1 布线优先级

1. 主开关 **Vin 与 Vsamp 之间的路径短、两侧差分匹配、对称寄生**。
2. $C_B$ 到关键 gate、well/boost node 的连接尽可能小寄生；避免与快速数字时钟平行长距离布线。
3. 自举栅节点不要被无关 dummy fill、guard ring 或跨层 coupling 限制；必须实际提取后比较。
4. 预充回路的电源与时钟 return path 可形成大量电流尖峰；必要时分层供电、局部去耦、guard ring、屏蔽和地回流优化。
5. 差分左右不仅几何对称，还要**时序负载、DNW 结寄生、时钟走线、电容 dummy 环境**对称。

### 17.2 主开关布局

多指 fingers 可降低某些串联栅电阻，但增加扩散边缘、布线复杂度与 overlap；不能简单地认为“更多 fingers 一定更快”。主开关 sizing 和布局要一起优化：$W_{tot}$、NF、SD 共享、poly/gate routing、junction area/perimeter、$R_{gate}$、$C_{gd}$、匹配与可靠性。

### 17.3 DSPF/Calibre View/EM 的分工

在自举开关这种跨越强非线性器件与高频寄生网络的电路中：DSPF 适合大量 RC 结点的精细寄生交付与分层仿真；Calibre View 便于完整后仿的回标与连接核对；关键高频长线、互耦和回流路径若 RC 提取不足，还需考虑含 inductive coupling 的 EM/传输线视角。最终判断取决于 PDK/QRC/PEX 的具体支持和频段，不存在“EM 一定替代 PEX”的通用结论。

## 18. 常见误区与设计失效案例

> [!warning] 原 PDF 的几个经验结论需要加限定
> - “$C_B$ 略大于 $C_S$”：取决于实际 bootstrap network，不是必须。
> - “所有管子取最小 $L$”：辅助开关仍可能受漏电、匹配、charge sharing 与可靠性约束；并非一定最优。
> - “主开关必须 DNW、body 接某节点”：取决于 isolated MOS、工艺阱结构与绝对电压，应按 PDK 检查。
> - “下极板必 12–16 bit、上极板必 8–10 bit”：仅经验比较，**不能作精度上限**。
> - “自举后 $R_{ON}$ 恒定”：只在消除了其他二阶因素的理想化条件下成立。

**Case 1：$R_{ON}$ 很低，SFDR 反而恶化。** 增大 $M_S$ 会增大 input capacitance、$Q_{ch}$、clock feedthrough 和非线性 junction loading。需要在固定 $C_S$、同输入摆幅下 sweep $W$ 并看 HD2/3，不应只用 $R_{ON}$ 最小做目标。

**Case 2：低频 90 dBc、高频只剩 60 dBc。** 首先看输入缓冲带宽和高频非线性、body effect、$R_{ON}(t)$ 的响应滞后；稳态 $V_G$ 达标不足以保证 GHz tracking。[R12,R14]

**Case 3：功能仿真通过、后仿严重恶化。** 自举路径的寄生可能让 $V_G$ 启动更慢，同时左右路径寄生差别形成 HD2；建议分别回标主信号 path、bootstrap path、clock path，建立原因归因。

**Case 4：提高 boost gate 最高电压改善 SFDR，但有可靠性隐患。** 要测全器件四种端点应力，尤其电源/时钟异常条件；更高 gate voltage 不是无成本优化。[R05]

**Case 5：多路径开关 speed 更快，但 THA→sub ADC 错位仍出现。** 这是 **clock phase-window** 问题，优化 BS 是局部补救而非时序完整性的充分条件。

## 19. 推荐精读路线

1. **Razavi 2021 [R04]**：能手画每一相回路、清楚每只管子的作用和 oxide-stress 约束。
2. **Ma 2025 TCAS-I [R12]**：把 source–drain exchange、capacitive division、charge redistribution 分别提取为模型与可测的失真贡献；尤其应复现论文中的参数扫参规律。
3. **Zheng 2016 [R07,R23] + Wang 2025 [R19]**：重点看“为什么井结和控制路径寄生比主开关 $R_{ON}$ 还重要”。
4. **Swindlehurst 2021 [R08] + Ramkaj 2020 [R09]**：双路径与双环路的区别，画各自的关键节点并比较哪类寄生转移到 auxiliary。
5. **Devarajan 2017 [R06] + Zhu 2023 [R14]**：超高速采样窗的启动时延与自举上升时间。
6. **Zhang ISSCC 2025 [R10] + Ding 2025 [R11]**：72 GS/s、14 GS/s 的路径拆分创新，重点复现公平的 baseline。
7. **Zhou 2026 [R20] + Bayazi 2026 [R21]**：验证新辅助支路和 FD-SOI 加速方法是否能跨工艺移植；分清仿真和实测。

### 建议在 Obsidian 中建立的子笔记

- `MOS 采样开关：Ron、体效应与电荷注入`
- `Bootstrap Switch：晶体管级时序和可靠性`
- `采样开关失真建模：HD2 HD3`
- `ADC 输入采样网络：THA、CDAC 与 Buffer`
- `28nm Bootstrapped Switch：Virtuoso 仿真清单`

---

## 20. 参考文献：经典、原 PDF 与新增论文

说明：原 PDF 第 13 页已引用 [R04,R06–R12] 等；下表补充了**新增的早期基础文献、2023–2026 新文献**以及与采样非线性相关的扩展工作。带“新增”是相对于原 13 页分享 PDF 而言，并非论文新近发表的标记。论文题目和 DOI 已尽量根据出版方或论文索引核对。正文的性能数值需结合完整原文条件阅读。

### A. 基础物理、理论、设计基础

| ID | 文献 | 核心内容 |
|---|---|---|
| [R01] 新增 | G. Wegmann, E. A. Vittoz, F. Rahali, **“Charge Injection in Analog MOS Switches,”** *IEEE JSSC*, 22(6), 1091–1097, 1987. [DOI](https://doi.org/10.1109/JSSC.1987.1052859) | 经典沟道电荷注入模型 |
| [R02] 新增 | A. M. Abo, P. R. Gray, **“A 1.5-V, 10-bit, 14.3-MS/s CMOS Pipeline Analog-to-Digital Converter,”** *IEEE JSSC*, 34(5), 599–606, 1999. [DOI](https://doi.org/10.1109/4.760369) | 低压 Pipeline ADC/BS 早期经典 |
| [R03] 新增 | C. Eichenberger, W. Guggenbühl, **“On Charge Injection in Analog MOS Switches and Dummy Switch Compensation Techniques,”** *IEEE TCAS*, 37(2), 256–264, 1990. [DOI](https://doi.org/10.1109/31.45719) | dummy / feedthrough 补偿理论 |
| [R04] 原 PDF | B. Razavi, **“The Design of a Bootstrapped Sampling Circuit [The Analog Mind],”** *IEEE Solid-State Circuits Magazine*, 13(1), 7–12, 2021. [DOI](https://doi.org/10.1109/MSSC.2020.3036143) | 晶体管级设计教学、最推荐入门 |
| [R05] 新增 | M. Dessouky, A. Kaiser, **“Very Low-Voltage Digital-Audio ΔΣ Modulator With 88-dB Dynamic Range Using Local Switch Bootstrapping,”** *IEEE JSSC*, 36(3), 349–355, 2001. [DOI](https://doi.org/10.1109/4.910473) | 低压 BS 及器件可靠性 |
| [R12] 原 PDF | J. Ma, J. Yu, Y. Hu, **“An Analysis and Design Guideline of High-Speed and Low-Distortion Bootstrapped Switches,”** *IEEE TCAS-I*, 72(8), 3813–3824, **2025**（2024-11-20 online）. [DOI](https://doi.org/10.1109/TCSI.2024.3497932) | **近期理论最核心**；三类非理想机制、实验验证 |

### B. 经典 GHz 采样开关与 TI-ADC 架构

| ID | 文献 | 核心内容 |
|---|---|---|
| [R06] 原 PDF | S. Devarajan *et al.*, **“A 12-b 10-GS/s Interleaved Pipeline ADC in 28-nm CMOS Technology,”** *IEEE JSSC*, 52(12), 3204–3218, 2017. [DOI](https://doi.org/10.1109/JSSC.2017.2747758) | 10 GS/s 高速 track 起始支路 |
| [R07] 原 PDF | X. Zheng *et al.*, **“A 14-bit 250 MS/s IF Sampling Pipelined ADC in 180 nm CMOS Process,”** *IEEE TCAS-I*, 63(9), 1381–1392, 2016. [DOI](https://doi.org/10.1109/TCSI.2016.2580703) | floating well 与寄生优化 |
| [R08] 原 PDF | E. Swindlehurst *et al.*, **“An 8-bit 10-GHz 21-mW Time-Interleaved SAR ADC With Grouped DAC Capacitors and Dual-Path Bootstrapped Switch,”** *IEEE JSSC*, 56(8), 2347–2359, 2021. [DOI](https://doi.org/10.1109/JSSC.2021.3057372) | dual-path / N-well 隔离 |
| [R09] 原 PDF | A. T. Ramkaj *et al.*, **“A 5-GS/s 158.6-mW 9.4-ENOB Passive-Sampling Time-Interleaved Three-Stage Pipelined-SAR ADC With Analog–Digital Corrections in 28-nm CMOS,”** *IEEE JSSC*, 55(6), 1553–1564, 2020. [DOI](https://doi.org/10.1109/JSSC.2019.2960476) | dual-loop 自举、passive sampling |
| [R10] 原 PDF | Y. Zhang *et al.*, **“A 72GS/s 9b Time-Interleaved Pipeline-SAR ADC Achieving 55.3/49.3dB SFDR at 20GHz/Nyquist Inputs in 16nm FinFET,”** *ISSCC*, 2025, pp. 436–438. [DOI](https://doi.org/10.1109/ISSCC49661.2025.10904672) | 改进 dual-path + dummy BS |
| [R11] 原 PDF | J. Ding, X. Guo, S. Lu *et al.*, **“A 14-GS/s 8-bit Time-Interleaved SAR ADC With Multi-Path Bootstrapped Switch and Low-Jitter Sampling PLL in 28-nm CMOS,”** *Microelectronics Journal*, 163, 106770, 2025. [DOI](https://doi.org/10.1016/j.mejo.2025.106770) | multi-path、辅助控制/加速 |
| [R13] 新增 | A. T. Ramkaj *et al.*, **“A 1.25-GS/s 7-b SAR ADC With 36.4-dB SNDR at 5 GHz Using Switch-Bootstrapping, USPC DAC and Triple-Tail Comparator in 28-nm CMOS,”** *IEEE JSSC*, 53, 2018. [DOI](https://doi.org/10.1109/JSSC.2018.2822823) | 高频输入采样 + 低分辨率 ADC |
| [R14] **新增·优先** | Y. Zhu *et al.*, **“A 38-GS/s 7-bit Pipelined-SAR ADC With Speed-Enhanced Bootstrapped Switch and Output Level Shifting Technique in 22-nm FinFET,”** *IEEE JSSC*, 58(8), 2300–2313, 2023. [DOI](https://doi.org/10.1109/JSSC.2023.3268238) | 原 PDF 缺少的重要高速 BS 实例 |
| [R16] 新增 | H. Zhuang, Q. Cao, X. Peng, H. Tang, **“A Bootstrapped Switch With Accelerated Rising Speed and Reduced On-Resistance,”** *ISCAS*, 2021. [DOI](https://doi.org/10.1109/ISCAS51556.2021.9401785) | 快速 bootstrap 专题 |
| [R23] 新增 | X. Zheng *et al.*, **“An S/H Circuit With Parasitics Optimized for IF-Sampling,”** *Journal of Semiconductors*, 37(6), 065005, 2016. [DOI](https://doi.org/10.1088/1674-4926/37/6/065005) | 与 [R07] 对应、聚焦 S/H 细节 |

### C. 2023–2026 新论文与扩展

| ID | 文献 | 结构/数据性质 |
|---|---|---|
| [R15] 新增 | C. Qin, Z. Cai, **“Bootstrapped Complementary Switches for High-Precision Sampling,”** *ISCAS*, 2023. [DOI](https://doi.org/10.1109/ISCAS46773.2023.10182008) | Complementary BS |
| [R17] 新增 | Y. Wang *et al.*, **“A 10-bit 40MS/s SAR ADC With a Low-Noise Low-Offset Dynamic Comparator and a High-Linearity Sampling Switch,”** *IEICE Electronics Express*, 21(12), 20240135, 2024. [DOI](https://doi.org/10.1587/elex.21.20240135) | bootstrapped CMOS complementary switch；报告电路仿真 |
| [R18] 新增 | Y. Cheng *et al.*, **“High Linearity Front-End Circuit for RF Sampling ADCs With Nonlinear Junction Capacitor Cancellation,”** *ISCAS*, 2023. [DOI](https://doi.org/10.1109/ISCAS46773.2023.10181839) | buffer+BS+结电容抵消 |
| [R19] **新增·优先** | M. Wang, Y. Gu, L. Zeng, Z. Tang, **“A Low-Distortion Bootstrapped Switch Based on Parasitic Capacitance Reduction Techniques,”** *Electronics Letters*, 61, e70172, 2025. [DOI](https://doi.org/10.1049/ell2.70172) | 动态 gate + DNW，180 nm **仿真** |
| [R20] **新增·2026** | J. Zhou, Z. Guo, S. Liu, R. Xu, **“A 94.52 dBc SFDR 89.86 dB SNDR High-Linearity Bootstrapped Switch for SAR ADC,”** *IEICE Electronics Express*, 23(6), 20250613, **2026-03-25**. [DOI](https://doi.org/10.1587/elex.23.20250613) | 辅助电容分支、55 nm **仿真** |
| [R21] **新增·2026** | M. Bayazi, J. He, R. Negra, **“A Bootstrapped Switch With Enhanced Rising Speed and Low Distortion Sampling Structure,”** *SMACD*, 2026（IEEE Xplore 2026-08-17）. [DOI](https://doi.org/10.1109/SMACD70206.2026.11647824) | 22 nm FD-SOI **后仿**、rise-time 改善 |
| [R22] 新增 | M. Zhang *et al.*, **“A Better-Tracking and Low-Feedthrough Bootstrapped Switch,”** *ECIE*, 2024. [DOI](https://doi.org/10.1109/ECIE61885.2024.10627088) | better tracking / feedthrough |
| [R24] 新增·2026 | **“A 125-μW 14-bit 5-MS/s Pipelined-SAR ADC With Linearity-Enhanced Bootstrapped Switch and kT/C Noise Cancellation,”** *Microelectronics Journal*, 172, 107147, 2026. [DOI](https://doi.org/10.1016/j.mejo.2026.107147) | 线性度与采样噪声协同；论文摘要 |
| [R25] 新增·2026 | **“Shallow Neural Network-Based Error Compensation of a Non-Linear SAR ADC Sampling Stage,”** *IEEE TCAS-I*, 73(6), 3986–3995, 2026. [DOI](https://doi.org/10.1109/TCSI.2025.3645475) | 采样误差数字补偿、硅片验证 |
| [R26] 新增·2024 | Y. Chen, H. San, **“A 2.8V Input Amplitude CMOS SAR ADC With 0.7V Supply Voltage,”** *IEEJ Transactions on Electronics, Information and Systems*, 144(8), 771–776, 2024. [DOI](https://doi.org/10.1541/ieejeiss.144.771) | 低电压/宽输入动态范围 BS |
| [R27] 新增·2024 | **“A TDC-Assisted SAR ADC With High-Speed Sampling Switches and Fine-Tuned Delay Cells,”** *Microelectronics Journal*, 147, 106184, 2024. [DOI](https://doi.org/10.1016/j.mejo.2024.106184) | 高速采样与时域量化相关 |
| [R28] 新增·2026 | **“A High-Linearity Input Buffer and Early-Trigger Scheme for GS/s Pipelined ADCs,”** *Microelectronics Journal*, 174, 107233, 2026. [DOI](https://doi.org/10.1016/j.mejo.2026.107233) | ping-pong bootstrapping 用于 input buffer；**不是**纯 BS 开关论文 |

### D. 延伸阅读与检索建议

- **IEEE Xplore / Google Scholar 关键词**：`bootstrapped sampling switch`, `bootstrap parasitic division`, `source-drain exchange`, `dual-path bootstrapped switch`, `floating well bootstrapped`, `junction capacitance cancellation`, `bootstrap switch gate overdrive`, `time-interleaved ADC sampling linearity`, `bootstrap oxide reliability`。
- 论文中关键 Fig 请优先查看：bootstrap transistor schematic、clock timing diagram、$V_{GS}(t)$、$R_{ON}(V_{IN})$、SFDR-vs-input-frequency、PVT corner 与 transistor overstress。
- 关于 $HD2/HD3$ 的详细时域积分法，重点研读 [R12] 正文，而不是仅凭摘要提炼普适幂次规律。

---

## 附：笔记更新记录

- **2026-10-26**：完整吸收源 PDF 第 2–12 页的关键原理和电路图片；重新整理了源漏交换、阱结、寄生分压、动态启动、电荷注入与噪声、时序、可靠性；新增 2023 JSSC 38 GS/s、2025 TCAS-I 解析失真、2025 Electronics Letters 动态 DNW、2026 ELEX 辅助电容和 2026 SMACD 加速方案；补充基础公式、示意图、Design Checklist、参考文献和精读顺序。
- 后续建议：按 [R12] 复现 HD3–$C_B$ 的定量公式；提取 28 nm BS 的差分 PVT/PEX 数据补全真实设计图；在 Zotero 中导入随包提供的 `Bootstrapped_Switch_References.bib`。