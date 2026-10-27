---
title: 高速 ADC Input Buffer：原理、架构与设计方法
date: '2026-09-14'
excerpt: 面向高速 ADC 输入缓冲器，系统梳理输入驱动架构、非线性与噪声、采样网络协同及验证流程。
tags:
- 学习记录
- 模拟集成电路
- analog-ic
- adc
- input-buffer
- source-follower
- fvf
- ssf
- push-pull
- ppsf
- bootstrap
- rf-sampling
---

# 高速 ADC Input Buffer：原理、架构与设计方法

> [!abstract] 核心定位
> 面向高速 ADC 输入缓冲器，系统梳理输入驱动架构、非线性与噪声、采样网络协同及验证流程。
>
> [!tip] 阅读主线
> 系统约束 → MOS 工作状态 → SF/FVF/SSF/Push-Pull → 非线性与噪声 → 采样协同 → 设计验证。
>
> [!info] 资料范围与证据边界
>
> 资料范围：2026-09-14 读取本地 Zotero `Input Buffer` 分类的全部 45 条文献元数据和 47 份 PDF 附件；对核心架构论文的相关正文、电路图和结果进行重点核读，其余条目用于摘要级筛选与延伸阅读。附录列出完整条目，不能将“有附件”理解成“每一篇均逐页精读”。会议稿与期刊扩展稿不作为独立技术突破重复计数。
>
> **证据标记**：文中“推导／估算”为明确假设下的分析；“论文实测”为原文所报告的测量；“论文仿真”为原理图或版图提取后结果。本文未执行任何 PDK 晶体管仿真，所有算例都不是流片性能承诺。
>
> **使用方式**：本文已适配 Obsidian；14 张论文截图保存在 `学习记录/高速 ADC Input Buffer/attachment`，通过库内嵌入链接显示。图为本地论文的原图区域截图，图注给出文献、原图号和 PDF 页码，图中标号服从原文；正文中的通用晶体管标号只在对应小节有效。原图版权归原作者及出版方。图片来源清单 保存逐图溯源信息。

## 目录

1. 系统位置与设计目标
2. MOS 参数与饱和裕量
3. 负载、驱动电流与采样窗口
4. SF：基本源跟随器
5. FVF：翻转电压跟随器
6. SSF：超级源跟随器及 Class-AB 扩展
7. Push-Pull／PPSF：互补主动驱动
8. 架构对比与选择
9. 非线性、HD2／HD3 与失真定位
10. Bootstrap 与辅助线性化
11. 带宽、settling、slew 与稳定性
12. 噪声与动态范围
13. Hierarchical buffer 与多级采样
14. THA／采样网络协同
15. S 参数与输入匹配
16. 技术演进与论文案例
17. 可执行的设计流程
18. PVT、Monte Carlo 与 post-layout
19. 版图与封装注意事项
20. 仿真 checklist
21. 常见误区与调试索引
22. 经典论文与阅读顺序
23. 附录 A：符号与速查公式
24. 附录 B：Zotero 分类完整索引
25. 附录 C：图片与资料核验说明

## 1. 系统位置与设计目标

### 1.1 Input buffer 到底隔离什么

典型信号链为：

```text
信号源／变压器／驱动器
        ↓
封装与 PCB → Pad / ESD / 匹配网络
        ↓
Input buffer → 走线／扇出 → 采样开关 + Cs → ADC 核心
```

ADC 的开关电容输入不是恒定电阻，也不是单纯的固定电容。开关接通时，采样电容与前一转换周期留下的电压发生电荷重分配；开关关断时存在电荷注入、时钟馈通；TI-ADC 的支路还会不断接入和断开。有限阻抗的信号源承受这些电流，就会产生与信号、时钟和历史样本相关的电压误差。

Buffer 用低输出阻抗及电源提供的驱动电流，让外部信号源主要面对较可控的输入导纳，同时承受内部采样网络的充放电需求。它可以降低反向扰动，但输入输出寄生耦合、供电及衬底耦合仍然存在，不能把“隔离”理解成完全单向。

![14_fanout](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/14_fanout.png)

*图 1：Huang 等，2022，原 Fig. 1，PDF 第 2 页。左图把封装、ESD、匹配、buffer、走线与采样阵列放在同一链路；右图表明实际扇出是一张分布网络。[论文 DOI](https://doi.org/10.1109/TCSII.2022.3188534)，Zotero：`B5HLXYYN`。*

### 1.2 它不等于 THA，也不一定需要增益为 1

- **连续时间 input buffer**：持续跟随输入，主要承担隔离、驱动、共模转换。
- **THA（track-and-hold amplifier）**：包含跟踪／保持动作，其输出在保持阶段维持采样值，可由输入 buffer、采样网络和输出 buffer 构成。
- **采样开关**：控制连接关系，不等价于线性电压缓冲器；其 $R_{on}$、寄生和时钟决定采样质量。
- **Residue amplifier**：处理量化残差，承担级间增益。论文标题里出现 SSF-based RA，不意味着 SSF 就是该 ADC 的前端输入 buffer。

Buffer 的信号增益可以小于 1，只要增益损失在输入满量程与噪声预算内。对于高频采样，稳定而可预测的 $0.8$ 倍增益往往比随幅度变化的“接近 1”更容易处理。若有数字增益修正，必须同时计入修正后的输入等效噪声，不能凭归一化掩盖信噪比损失。

### 1.3 指标必须带测量条件

| 维度 | 需要写清楚的条件 |
|---|---|
| 速度 | 总 $f_s$、每通道 $f_s$、最高 $f_{in}$、模拟输入带宽、有效 track 时间 |
| 信号 | 单端／差分、峰值／峰峰值／RMS、输入和输出共模、直流是否必须通过 |
| 负载 | 每侧 $C_s$、有效接入通道数、off-switch 电容、走线 RC、bootstrap 负载 |
| 线性度 | HD2、HD3、THD、SFDR、IM3；在哪个节点、是否经过采样及校准 |
| 噪声 | 输入或输出等效、单边或双边 PSD、积分带宽、是否含采样折叠 |
| 功耗 | 单支路／差分、是否含 bias、CMFB、bootstrap、时钟、负电源生成 |
| 可靠性 | PDK 器件类型、所有端口电压、启动与掉电条件 |

核心折中可以概括为：带宽、线性、噪声、功耗、输入电容、摆幅与稳定性相互制约。没有一个孤立的 $R_{out}$ 数值能代表完整设计质量。

### 1.4 为什么有时用更高电压或负电源

额外电压空间可容纳跟随器、电流源、cascode 及 drain bootstrap，同时保持期望的输出共模。在给定摆幅下，远离三极区也可能减弱 $g_{ds}$ 与电容的急剧变化。代价是更高的电源功耗、供电与版图复杂度，以及器件可靠性验证。

例如 Devarajan 等的 2017 设计采用 $+2\,\mathrm V/-1\,\mathrm V$ buffer 电源和多级 bootstrap；Cao 等的 2024 设计则通过电流补偿，在 $+1.1\,\mathrm V/-0.1\,\mathrm V$ 下实现 PP-SF。两者说明高电压是可选设计资源，不能写成高速 buffer 的必然要求。见第 16 节对应论文。

## 2. MOS 参数与饱和裕量

### 2.1 电压符号：先规定方向

对 NMOS：

$$
V_{GS}=V_G-V_S,\qquad V_{DS}=V_D-V_S,\qquad V_{SB}=V_S-V_B.
$$

$$
V_{OV}=V_{GS}-V_{TH}.
$$

对 PMOS，建议用正量比较：

$$
V_{SG}=V_S-V_G,\qquad V_{SD}=V_S-V_D,\qquad V_{OV,p}=V_{SG}-|V_{TH,p}|.
$$

| 参数 | 物理含义 | 在 buffer 中应怎样看 |
|---|---|---|
| $V_{GS}$／$V_{SG}$ | 栅相对源的控制电压 | 决定反型程度；源端随信号动，因此不能只看栅压 |
| $V_{TH}$ | 给定偏置下的有效阈值 | 随工艺、温度、体偏置、DIBL 变化，不是永远固定的常数 |
| $V_{OV}$ | 栅源电压超出阈值的量 | 长沟道强反型近似中联系电流、$g_m$ 和摆幅 |
| $V_{DS}$／$V_{SD}$ | 电流通路的端电压 | 影响工作区、输出电导、阈值及结电容 |
| $V_{DSAT}$ | 模型定义的饱和边界相关电压 | 必须按具体模型的符号和定义使用 |
| 饱和裕量 | 实际端电压超过饱和边界的量 | 要看整个波形的最小值，而不只是 DC |

### 2.2 长沟道近似能说明什么

在强反型、长沟道、忽略二阶效应时：

$$
I_D\simeq \frac{1}{2}\mu C_{ox}\frac WL V_{OV}^2, \qquad g_m\simeq \frac{2I_D}{V_{OV}}, \qquad \frac{g_m}{I_D}\simeq\frac{2}{V_{OV}}.
$$

若加入一阶沟道长度调制：

$$
I_D\simeq \frac{1}{2}\mu C_{ox}\frac WL V_{OV}^2(1+\lambda V_{DS}), \qquad r_o\simeq\frac{1}{\lambda I_D}.
$$

它们适合建立直觉：增大电流或尺寸可提高 $g_m$；较大的 $g_m$ 通常降低输出阻抗；$V_{DS}$ 改变会引起电流改变。它们不适合直接预测 28 nm、FinFET、FDSOI 的宽频 HD3，也不能把一个拟合的 $\lambda$ 当成全摆幅、全频率的固定器件属性。

### 2.3 $V_{DSAT}$ 为什么不等于 $V_{OV}$

经典长沟道模型以沟道末端夹断得到 $V_{DSAT}\approx V_{OV}$。短沟道器件还受到速度饱和、迁移率退化、源漏串联电阻和模型平滑等影响。仿真器的 `vdsat` 是所用紧凑模型的工作点结果，不能用手算的 $V_{GS}-V_{TH}$ 强行代替。

BSIM4 的饱和电压模型中显式包含速度饱和等因素；这能说明上述差别，但 **BSIM4 公式也不能跨用到所有 FinFET／FDSOI 模型**。设计时查 PDK 实际使用的模型和输出量定义。[BSIM4 原始模型手册](https://www.cmosvlsi.com/BSIM4_manual.pdf)

### 2.4 饱和裕量要做成动态指标

对正常方向工作的 NMOS：

$$
M_n(t)=V_{DS,n}(t)-V_{DSAT,n}(t).
$$

对 PMOS，先把模型量转换为对应正的饱和电压大小：

$$
M_p(t)=V_{SD,p}(t)-V_{SDAT,p}(t).
$$

对每个关键管记录：

$$
M_{\min}=\min_{t,\,\mathrm{PVT},\,\mathrm{load},\,\mathrm{input}}M(t).
$$

必须同时观察 $I_D(t)$、$g_m(t)$、$g_{ds}(t)$、body 电压和内部节点恢复。$M>0$ 说明模型意义下有饱和余量，不证明失真达标；$M$ 刚过零也不等于电路突然完全失效。现代模型过渡平滑，实际影响可能体现为压缩、电容变化、尾部拖长或环路增益降低。

Devarajan 等 2017 年设计明确报告约 $>150\,\mathrm{mV}$ 的 $V_{DS}-V_{DSAT}$ 裕量。这是**该设计**的偏置选择，不能作为所有工艺的统一规格。[原文 §III-B，PDF 第 7 页](https://doi.org/10.1109/JSSC.2017.2747758)

### 2.5 体效应与 DIBL

长沟道 NMOS 体效应常用近似：

$$
V_{TH}(V_{SB})=V_{TH0}+\gamma\left(\sqrt{2\phi_F+V_{SB}}-\sqrt{2\phi_F}\right).
$$

固定 body 时，source 跟随信号移动，$V_{SB}$ 变化，阈值也变化，产生增益损失和失真。定义小信号体跨导大小 $g_{mb}$ 后，固定 body 的 SF 增益通常包含 $g_{mb}$。

DIBL 可用定性式表示：

$$
\Delta V_{TH}\simeq-\eta\Delta V_{DS}.
$$

因此 drain bootstrap 不只针对“$\lambda$ 非零”，也可能降低漏端变化通过 DIBL 产生的调制。Body 接 source 可降低体效应，但会使 well／deep-well 寄生跟随信号，新的非线性电容负载必须计入；bulk CMOS 的独立 NMOS body 通常需要隔离阱结构。FDSOI 的 back-gate 物理结构与 bulk CMOS 的导电体结不同，不能照搬连法和电压限值。

### 2.6 $W/L$、$g_m/I_D$ 与高频之间的矛盾

固定 $I_D$ 增大 $W$：通常提高 $g_m/I_D$，但也增加栅电容、结电容及前级负载。固定 $W$ 增大 $I_D$：可提高 $g_m$ 和驱动，代价是功耗、压降、自热，且未必总在最佳 $f_T$ 区域。增大 $L$：可能改善 $r_o$、匹配及某些静态失真，却增加电容、降低速度。

$$
f_T\approx\frac{g_m}{2\pi(C_{gs}+C_{gd})}
$$

只是简化尺度关系。实际应扫描 $L$、电流密度、$V_{DS}$、体偏置，查 $g_m/I_D$、$g_m/g_{ds}$、$f_T$、$C_{in}$ 与噪声，寻找满足输入电容约束的 Pareto 解。高 $g_m/I_D$ 并不自动等于高速最优。

## 3. 负载、驱动电流与采样窗口

### 3.1 不要直接把所有 $C_s$ 相加

若某个 track 相位只有一个子 ADC 接入，可先估计每侧：

$$
C_{L,\mathrm{track}}\approx C_s+C_{on,par}+\sum C_{off,par}+C_{wire}+C_{aux}.
$$

其中 $C_{aux}$ 包括由该节点直接驱动的 body、bootstrap 和其他支路。断开的支路通过关断开关寄生仍然可见；走线还有电阻、耦合电容和可能的电感。若采样窗口重叠，多个 $C_s$ 会同时接入。更精确的对象是**随时钟、信号和历史状态变化的多端口网络**，而不是一个固定 $C_L$。

### 3.2 $I=C\,dV/dt$ 的使用边界

线性固定电容：

$$
i_C(t)=C\frac{dv(t)}{dt}.
$$

如果电容随电压变化，应从电荷定义出发：

$$
i(t)=\frac{dQ(v)}{dt}=C_{\mathrm{diff}}(v)\frac{dv}{dt}, \qquad C_{\mathrm{diff}}(v)=\frac{dQ}{dv}.
$$

PDK 的电容工作点量往往属于电荷导数；不能把它当作 $Q=C(v)v$ 中的比例系数，再额外加一遍 $v\,dC/dt$。完整 MOS 是多端电荷模型，还存在交叉偏导。

### 3.3 正弦电流与差分幅度

若每侧输出为：

$$
v_o(t)=V_{CM}+V_{p,se}\sin(2\pi f_{in}t),
$$

则固定对地负载电容需要：

$$
I_{pk}=2\pi f_{in}C_LV_{p,se}.
$$

对于对称差分信号：

$$
V_{p,se}=\frac{V_{pp,diff}}4,\qquad V_{rms,diff}=\frac{V_{pp,diff}}{2\sqrt2}.
$$

**算例**：每侧 $C_L=0.6\,\mathrm{pF}$、$f_{in}=4\,\mathrm{GHz}$、差分 $V_{pp}=1.2\,\mathrm V$，则每侧峰值 $0.3\,\mathrm V$，所需正弦电容电流约为：

$$
I_{pk}=2\pi\times4\times10^9\times0.6\times10^{-12}\times0.3 \approx4.52\,\mathrm{mA}.
$$

这不是所需静态偏置电流的唯一答案：还要检查电流变化造成的失真、开关接通瞬间的电荷重分配、寄生、PVT 和正负方向驱动余量。如果主要电容跨在差分两端，须先转换到奇模半电路，不能套用“每侧对地 $0.6\,\mathrm{pF}$”的算例。

### 3.4 电荷重分配比正弦估算更尖锐

采样电容接入前后相差 $\Delta V$，需要转移：

$$
\Delta Q=C_s\Delta V,\qquad I_{avg}\ge\frac{C_s|\Delta V|}{t_{available}}.
$$

若近似为电阻主导的突然接通，初始电流可达 $\Delta V/R_{path}$。该峰值受到开关导通速度和寄生限制，与 $2\pi fCV_p$ 不是同一物理事件。设计应同时覆盖连续跟踪电流与离散重采样电流。

### 3.5 $f_s$ 与 $f_{in}$ 各自决定什么

- $f_{in}$：输入信号斜率、模拟通路跟踪能力、电容电流、抖动敏感度及高频寄生失真。
- $f_s$：采样事件密度、可用时序、采样折叠关系及一部分动态功耗。
- TI 每通道速率：该通道转换时间，但不直接等于公共 buffer 的 track 时间。

例如 8 路交织、总 $8\,\mathrm{GS/s}$，每通道 $1\,\mathrm{GS/s}$。如果公共输入限制为同时只有一条支路跟踪，每支路的有效窗口可能接近总周期 $125\,\mathrm{ps}$，而不是 $1\,\mathrm{ns}$。欠采样系统也可能 $f_{in}\gg f_s/2$，低采样率不保证 buffer 容易设计。

### 3.6 先用一阶 settling 得到下限

对幅度为 $\Delta V$ 的阶跃，一阶响应残差为：

$$
e(t)=\Delta V e^{-t/\tau}.
$$

若允许误差 $\epsilon=V_{FS}/2^{N+1}$，且阶跃等于该节点满量程 $V_{FS}$：

$$
\frac{|e(t)|}{V_{FS}}<2^{-(N+1)},\qquad \frac{t}{\tau}>(N+1)\ln2.
$$

12-bit、半 LSB、有效建立时间 $100\,\mathrm{ps}$ 给出：

$$
\tau<11.10\,\mathrm{ps},\qquad f_p>14.34\,\mathrm{GHz}.
$$

若每侧等效电容 $0.6\,\mathrm{pF}$，则总充电通路电阻需约小于 $18.5\,\Omega$。这包括 buffer、开关和走线的等效贡献；若开关本身已超过预算，仅把 buffer 做大不能完成目标。

该估算假定单极点、满幅阶跃、无 slew、无振铃、无噪声、目标值固定。真实连续正弦跟踪的线性幅相误差不能直接套成“每次必须追上一个满幅 DC 阶跃”；分层 THA 的第二级面对保持值时，阶跃建立模型则更直接。

## 4. SF：基本源跟随器

### 4.1 电路与工作过程

以 NMOS SF 为例：主管 $M_1$ 的 gate 接输入，drain 接电源，source 为输出；输出经偏置电流源向地放电，负载接在输出。

```text
VDD
 │
 D
M1 ← gate = Vin
 S
 ├──── Vout → load
 │
Ibias
 │
VSS
```

输入升高使 $V_{GS1}$ 增大，$M_1$ 电流增加，给负载充电，输出随后上升，使 $V_{GS1}$ 回落。输入降低使主管电流减少，由下方电流源放电。SF 自身存在由 source 电压构成的局部反馈，只是没有附加的高增益反馈级。

直流近似：

$$
V_{out}\approx V_{in}-V_{GS1}.
$$

这说明共模会移位，也说明 $V_{GS1}$ 的信号依赖性直接进入输出误差。PMOS SF 的极性相反，其输出通常相对输入向上平移。

### 4.2 小信号增益和输出阻抗

在 drain、body 及偏置栅均为交流地，忽略电容时：

$$
A_v\approx\frac{g_m}{g_m+g_{mb}+g_{ds,1}+g_{o,bias}+G_L}.
$$

外部负载移除、输入理想交流接地时：

$$
R_{out}\approx\frac{1}{g_m+g_{mb}+g_{ds,1}+g_{o,bias}}.
$$

若 body 随 source 理想移动，体效应项不再按固定 body 形式出现。$R_{out}\approx1/g_m$ 是忽略其他电导后的近似；输入源阻抗有限、内部寄生显著时，$Z_{out}(f)$ 要由完整电路求得。

需要区分：主晶体管的 $r_o=1/g_{ds}$ 通常希望大；整个 buffer 的 $R_{out}$ 通常希望小。Drain bootstrap 提高前者，并不意味着希望整个 buffer 输出变“软”。

### 4.3 带宽不是只有输出极点

若输出为主导极点：

$$
f_{p,out}\approx\frac{1}{2\pi R_{out}C_{out}}.
$$

输入门极电流的一个简化表达为：

$$
i_{in}\approx sC_{gs}(v_{in}-v_{out})+sC_{gd}(v_{in}-v_d).
$$

drain 交流接地、低频跟随良好时，可理解为有效输入电容近似包含 $C_{gd}+C_{gs}(1-A_v)$。高频 $A_v$ 具有相位并下降，该“自举减小的输入电容”不再是固定实数；再叠加 ESD、走线和 bias，输入极点可能先限制带宽。

### 4.4 大信号充放电不对称

$$
C_L\frac{dv_o}{dt}=i_{M1}-I_B-i_{other}.
$$

对 NMOS SF，下降时主管趋向截止，能提供的放电电流大致受 $I_B$ 限制：

$$
|SR_{down}|\lesssim \frac{I_B}{C_L}.
$$

上升时主管可以暂时提供超过静态值的电流，但受输入过驱动、饱和裕量和电源限制。PMOS SF 的强弱方向相反。因此“增大 $g_m$”主要是小信号说法，“足够大的偏置保证两个方向建立”是大信号问题。

### 4.5 非线性链条

负载电流变化 $\rightarrow I_{D1}$ 变化 $\rightarrow V_{GS1}$ 变化 $\rightarrow V_{out}$ 偏离理想跟随；同时输出移动改变 $V_{DS1}$ 和 $V_{SB1}$。即使已经消除体效应，电流调制、DIBL、$g_{ds}$ 和结电容仍然存在。

对于平方律，可以围绕静态电流写出：

$$
V_{OV}(I_B+\Delta i)\approx V_{OV0} \left[1+\frac12\frac{\Delta i}{I_B}-\frac18\left(\frac{\Delta i}{I_B}\right)^2 +\frac1{16}\left(\frac{\Delta i}{I_B}\right)^3\right].
$$

这个局部展开解释了为何 $\Delta i/I_B$ 很大时失真迅速增加，也解释了“偏置刚好大于峰值负载电流”通常不能保证高 SFDR。它不提供先进工艺的精确谐波数值。

### 4.6 SF 的合理应用

SF 适合做最简单的基准电路、输入电容受限的小负载驱动，以及允许使用电流换速度的前端。若引入复制电容前馈、drain bootstrap、body 跟随，它可形成很强的 RF buffer。不要把“传统 SF”与“所有 SF-based 改进架构”混为一类。

## 5. FVF：翻转电压跟随器

### 5.1 为什么叫 flipped

经典 NMOS FVF 把主跟随管的偏置电流源放到其 **drain 上方**。定义主管 $M_1$：gate 接 $V_{in}$，source 接 $V_{out}$，drain 为内部节点 $x$；上方电流源向 $x$ 注入 $I_B$；反馈 NMOS $M_2$ 的 gate 接 $x$、drain 接输出、source 接低电源。

```text
VDD → Ib → x → M1(D→S) → Vout → M2(D→S) → VSS
             ↑ gate=Vin             ↑ gate=x
```

![01_fvf_comparison](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/01_fvf_comparison.png)

*图 2：Huang 等，2022，原 Fig. 2，PDF 第 2 页。(a) 为 SF 加前馈补偿，不是裸 SF；(b) 为经典 FVF；(c) 为 AC 耦合扩展。对照电流源位置及反馈支路阅读。[论文 DOI](https://doi.org/10.1109/TCSII.2022.3188534)，Zotero：`B5HLXYYN`。*

### 5.2 负反馈如何发生

固定输入，假设负载突然吸走更多电流：

1. 输出先下降，主管 $V_{GS1}$ 增大，倾向吸走更多 drain 电流。
2. 上方电流源无法立即提供更多电流，内部节点 $x$ 下降。
3. $M_2$ 的栅压下降，分流电流减小。
4. 留给负载的电流增加，抑制输出下降。

低频稳态下，$I_{D1}\approx I_B$，输出负载电流变化主要由 $M_2$ 调节。因而主管的电流相关 $V_{GS}$ 变化减小。有限电流源输出电阻、体效应及内部寄生仍会破坏“恒流”的理想性。

### 5.3 低输出阻抗从哪里来

内部节点把源端误差转换为较大的电压变化，再由 $g_{m2}$ 形成纠正电流。高局部增益、低频条件下：

$$
R_{out,FVF}\approx\frac{1}{g_{m1}g_{m2}r_{x}},
$$

其中 $r_x$ 是内部节点实际有效阻抗，常由主管输出电阻与偏置源等并联决定。文献常简写 $r_x\approx r_{o1}$；如果 $g_{m1}\approx g_{m2}\approx g_m$，才得到数量级式 $1/(g_m^2r_o)$。

更一般地可理解为 $Z_{out}\sim Z_{out,0}/(1+T)$，但具体 $T(s)$ 必须按电路定义。随频率升高，节点 $x$ 的电容使反馈减弱，不能把 DC 的低阻抗延伸到无限频率。

### 5.4 最容易误解的限制：双向驱动并不对称

忽略寄生电流，有：

$$
i_L=I_B-i_{M2}.
$$

当负载需要正的供给电流时，$M_2$ 最多降到近截止，因此经典 NMOS FVF 的供给能力受 $I_B$ 限制；当需要吸收负载电流时，$M_2$ 可以增大电流，能力受自身尺寸、栅压和裕量限制。

所以 **经典 FVF 的低小信号输出阻抗，并不意味着正负方向都能提供很大电流**。互补 FVF、Class-AB FVF、AC 耦合双环等是在解决进一步的问题，必须单独分析。

### 5.5 为什么摆幅容易受限

以低电源为零，经典结构 $x=V_{GS2}$。要使 $M_1$ 与 $M_2$ 均有饱和裕量：

$$
V_{out}\ge V_{DSAT2}+M_{req,2},
$$

$$
V_{out}\le V_{GS2}-V_{DSAT1}-M_{req,1}.
$$

上界与反馈管的 $V_{GS2}$ 绑定，可能比接近 $V_{DD}$ 的直觉上界窄得多；同时还要满足顶端电流源饱和条件。$V_{GS2}$ 本身随所需分流电流变化，真正的上下界也是动态的。

### 5.6 AC 耦合 FVF 的收益和新问题

Huang 等 2022 年结构用电容闭合高频反馈，借助独立 DC bias 与叠接管解除经典 FVF 中某些直流电位绑定；并通过 drain 跟随及补偿电容进一步改善线性。这并非“加一颗电容就保持所有 DC 性能”。

$$
H_{AC}(s)\approx\alpha\frac{s\tau_c}{1+s\tau_c},\qquad \alpha\approx\frac{C_c}{C_c+C_{par}}.
$$

低频反馈可能变弱；中频受耦合比例影响；高频还受内部极点限制。需要额外检查上电偏置、长时间无输入、突发输入、基线恢复及低频信号范围。该论文按 $>100\,\mathrm{MHz}$ 输入范围设计耦合网络，因此不能直接当作精密 DC buffer。

**读取结论**：这篇论文提供整颗 8-GS/s ADC 的实测支持，但 buffer 各线性化开关配置间的收益主要通过仿真比较；不能把全部改善量都写成实测隔离出的 buffer 收益。

## 6. SSF：超级源跟随器及 Class-AB 扩展

### 6.1 名称需要配合电路识别

SSF 通常指加入局部增益和主动输出支路的 super source follower。不同文献会称改进形式为 enhanced SSF、Class-AB SSF 或 AC-coupled SSF；部分机制与 FVF 重叠。分类时应记录：**谁感测误差、哪个节点提供增益、哪只管给负载供电、DC 偏置如何设置**，而不只看缩写。

![02_ssf_essf](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/02_ssf_essf.png)

*图 3：Guo 等，2025，原 Fig. 1，PDF 第 1 页，左为传统 SSF，右为加入共栅级的 ESSF。原文结果属于后仿。该图用于识别结构，不代表 SSF 最早提出时间。[论文 DOI](https://doi.org/10.1109/ICTA68203.2025.11329604)，Zotero：`DLDWSRMX`。*

### 6.2 一种典型 SSF 的反馈方向

图 3 左侧中，NMOS $M_{N1}$ 的 source 为输出，drain 为感测节点 $x$；顶端偏置源提供主管偏置；PMOS $M_{P3}$ 的 gate 接 $x$、source 接 $V_{DD}$、drain 接输出；底部仍有偏置吸电流支路。

当输出降低：$V_{GS,N1}$ 增大，$x$ 被向下拉，$M_{P3}$ 的 $V_{SG}$ 增大，向输出提供更多电流，形成恢复动作。与经典 NMOS FVF 相比，辅助管通过 PMOS 主动向输出供电，反馈连接和压头关系改变了。

### 6.3 小信号优势与低频近似

若感测节点增益约为 $g_{m1}r_x$，辅助输出管跨导为 $g_{m3}$：

$$
R_{out,SSF}\approx\frac{1}{g_{m1}r_xg_{m3}}
$$

适用于局部增益足够大及相关管保持正常工作区的情况。这个数量级与 FVF 类似，不表示两者在摆幅、供电噪声、频率响应和大信号电流上等价。

### 6.4 Class-AB SSF：让两个方向都获得动态电流

传统 SSF 某个方向仍可能受固定电流源限制。Class-AB 扩展将误差信号同时送往供电和吸电流支路，在静态功耗较低时提供更大的瞬态电流。AC 耦合允许 DC 电流由偏置网络设置，而交流动态驱动由内部节点控制。

![03_differential_ssf](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/03_differential_ssf.png)

*图 4：Shifman 等，2019，原 Fig. 4，PDF 第 2 页。(a) 为 Class-AB SSF，(b) 为差分改进结构。红色、绿色、橙色及蓝色线路对应原文的支路修改，阅读时同时追踪 bias、共模调节与交叉补偿。[论文 DOI](https://doi.org/10.1109/A-SSCC47793.2019.9056969)，Zotero：`MQDUICAW`。*

对图 4(a) 的特定结构，论文给出：

$$
R_{out}\approx\frac{1}{g_{m1}r_{o1}(g_{m4}+\alpha g_{m3})}, \qquad\alpha=\frac{C_1}{C_1+C_g}.
$$

其中 $\alpha$ 说明耦合电容不能任意缩小：如果栅寄生占比过大，动态增益下降。增大耦合电容又会增加面积、前级负载和低频恢复时间，且真实 $\alpha$ 会随频率和偏置变化。

### 6.5 差分结构为什么还需要 DC 调节

高阻节点对电流失配敏感：

$$
\Delta V_x\approx\Delta I\,r_x.
$$

很小的偏置失配即可使 $x$ 明显偏移，甚至让反馈管进入截止或三极区。Shifman 等使用低频共模调节稳定内部节点，并分离静态电流源与动态转向支路，以改善供电噪声抑制。这里的 43-dB PSRR 不能理解为从 DC 到最高信号频率都恒定为 43 dB，也不能假定任意 SSF 都拥有同样 PSRR。

### 6.6 嵌套采样中的特殊位置

2019 年设计位于 TH1 与 TH2 之间，其输入在部分时间是一个保持电容，而不是理想低阻电压源。输入输出寄生耦合会改变 TH1 已保持的电压。它是学习 **buffer + 浮置输入 + settling + ISI** 的重要案例；直接复制成焊盘级 RF 输入 buffer 时，需要重新评估源阻抗与噪声条件。

### 6.7 ESSF 和双环不应只看 DC 增益

加入共栅／电平移位级可改善摆幅，并增加局部增益；加入 FVF 支路可改善另一方向驱动。但是内部节点、耦合网络及共模环路也更多。必须逐环测试及整体瞬态验证，不能用额外一个 $g_mr_o$ 因子直接宣布真实带宽等比例提升。

2025 年 Class-AB ESSF 论文给出 24-GHz 带宽及高频 SNDR 的后仿案例。它说明 SSF/FVF 和 Class-AB 可组合，不构成“SSF 普遍优于所有 PP”的实测证据。

## 7. Push-Pull／PPSF：互补主动驱动

### 7.1 Push-Pull 是驱动方式，PPSF 是一类实现

Push-Pull 泛指两个支路分别增强供给和吸收电流；可能基于源跟随器、共源级、BJT 或其他结构。本文 **PPSF／PP-SF** 指互补 push-pull source follower。它不等于 CMOS 数字反相器：反相器由两个 drain 汇合输出，而典型 PPSF 由两个 source 汇合输出，门极通常通过不同的 level shift 接收同相交流输入。

### 7.2 基本连接与偏置

上方 NMOS：drain 接高电源，source 接输出；下方 PMOS：source 接输出，drain 接低电源。两者 gate 接受同相输入变化，但直流偏置不同：

$$
V_{GN}=V_{in}+V_{LS,N},\qquad V_{GP}=V_{in}-V_{LS,P}.
$$

$$
V_{GN}-V_{out}=V_{GS,N},\qquad V_{out}-V_{GP}=V_{SG,P}.
$$

因此门极间所需偏置差为：

$$
V_{GN}-V_{GP}=V_{GS,N}+V_{SG,P}.
$$

若把两个 gate 不经 level shift 直接短接，通常无法获得期望的低失真静态工作点。不能把普通反相器的偏置经验直接照搬到 PPSF。

### 7.3 信号上升和下降时的电流

$$
C_L\frac{dv_o}{dt}=i_N-i_P-i_{other}.
$$

输入上升：NMOS 的供给电流增加，PMOS 吸电流减小，合成正的负载电流；输入下降：NMOS 电流减小，PMOS 吸电流增加，合成负的负载电流。两个支路都响应输入，而不是其中一个永远是固定偏置负载。

### 7.4 $g_{mN}+g_{mP}$ 与电流复用

在两个门极获得相同交流信号，忽略 body、有限 $r_o$ 及耦合衰减时：

$$
R_{out,PPSF}\approx\frac{1}{g_{mN}+g_{mP}}.
$$

更完整的简化小信号增益为：

$$
A_v\approx\frac{g_{mN}A_N+g_{mP}A_P} {g_{mN}+g_{mP}+g_{mb,N}+g_{mb,P}+g_{ds,N}+g_{ds,P}+G_L},
$$

其中 $A_N(s),A_P(s)$ 是两个 level-shift 路径的传输。Body 随 source 运动时需重新处理相应项。

同一静态电流可依次通过上下器件，两个器件都贡献跨导，这就是电流复用。所谓“效率约两倍”依赖近似相等的有效跨导及一致的比较口径；计入 PMOS 为获得相当 $g_m$ 增加的面积、level shift、replica、CMFB 和额外供电后，整机功耗不一定减半。

### 7.5 PPSF 与 Class-A／Class-AB 不同维度

- Class-A：在规定信号范围内，两支路始终导通。
- Class-AB：静态两支路导通，但大信号某些区间有一支路电流明显减小或近截止；动态峰值电流可远高于静态值。
- Class-B／过低偏置：可能出现交越区域低跨导和明显失真。

**PPSF 不是天然无交越失真，也不一定被设计成 Class-AB。** 对高 SFDR ADC，常需要足够静态导通以保持总跨导平滑。应画出 $i_N(t)$、$i_P(t)$ 与 $g_{mN}(t)+g_{mP}(t)$；仅看漂亮的正弦输出难以判断工作类别。

### 7.6 互补对称能改善什么

理想对称下，某些偶次项可以抵消，总跨导变化也可能比单支路小。但 NMOS／PMOS 的迁移率、$V_{TH}$、输出电导、寄生和温度系数并不镜像；level-shift 路径幅相不一致也会破坏抵消。二次项减小并不意味着三次项消失。

### 7.7 带 drain bootstrap 的 PPSF

![04_ppsf_bootstrap](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/04_ppsf_bootstrap.png)

*图 5：Devarajan 等，2017，原 Fig. 11，PDF 第 7 页／期刊第 3210 页。输出最近的互补跟随管外还有两层 cascode／bootstrap；右侧给出 level shifter。这里展示的是 input buffer，不是同页的 MDAC 放大器。[论文 DOI](https://doi.org/10.1109/JSSC.2017.2747758)，Zotero：`JI8G84VA`。*

阅读顺序：先从中点输出识别主 NMOS／PMOS；再沿 source-drain 方向向电源找外层管；最后追踪各栅极的 LS 驱动与 body 连接。主管 source 和 drain 同相移动，减小 $\Delta V_{DS}$；最外层仍承担大的电压变化，其栅电流由哪个节点提供非常关键。

原文特意避免让最外层 gate 的非线性电流直接由输入或输出承担，而选择内层 cascode 的 source 驱动。这个细节说明，线性化往往是在**重新分配非线性电流的路径**。

### 7.8 PPSF 的设计关注点

输入电容与前级驱动；上下 $g_m$ 比值；静态电流控制；输入／输出共模；所有管的动态裕量；LS 高频幅相一致性；CMFB 启动与稳定性；体二极管及阱寄生；输出大信号恢复；负电源或多电源的真实功耗。它的高频潜力来自短而强的信号路径，最终性能仍取决于这些辅助环节。

## 8. 架构对比与选择

### 8.1 同条件下的机制比较

下表是结构机制对比，**不是跨工艺性能排名**。输出阻抗列为低频、有效偏置条件下的数量级。

| 架构 | 降低输出阻抗的机制 | $R_{out}$ 近似 | 大信号特点 | 主要代价／局限 |
|---|---|---|---|---|
| 裸 SF | 主管 source 反馈 | $1/g_m$ | 单方向容易受偏置限制 | 电流调制、body、$V_{DS}$ 与寄生失真 |
| SF + FFC | 复制负载交流电流，减少主管电流变化 | 需按完整电路求解，不保证仅靠 FFC 大幅降低 | 改善目标负载下动态线性 | 复制电容增加输入负担，负载变化破坏匹配 |
| 经典 FVF | 主管 drain 节点驱动分流反馈管 | $1/(g_{m1}g_{m2}r_x)$ | 一个方向仍受固定供给电流限制 | 输出摆幅、内部极点、稳定性 |
| AC 耦合 FVF | 高频局部反馈 + 独立 DC bias | 有效反馈频段内低 | 取决于反馈支路与静态电流 | 低频退化、恢复时间、更多寄生 |
| 传统 SSF | 感测节点增益 + 辅助共源输出管 | $1/(g_{m1}r_xg_{m3})$ | 增強一方向，另一方向需单独检查 | 感测节点偏置、PSRR、压头 |
| Class-AB SSF／ESSF | 双向动态电流及局部反馈 | 结构相关，可更低 | 峰值驱动／静态电流比可提高 | 多环路、内部节点失配、交越及恢复 |
| PPSF | 互补跨导相加及电流复用 | $1/(g_{mN}+g_{mP})$ | 双向主动响应，可 Class-A 或 AB | LS、互补不对称、输入电容、静态三次失真 |
| Bootstrapped PPSF | PPSF + 减小主管端电压变化 | 仍主要由总跨导及辅助支路决定 | 保留双向驱动 | 更高压头、外层寄生电流、可靠性 |
| 两级 CCSF | PMOS SF 与 NMOS SF 级联，结合补偿 | 由末级和反馈决定 | 前后级分担输入和输出负载 | 两级噪声／功耗、额外极点、可能形成隐含反馈 |

SSF、FVF、Class-AB、bootstrap 并非互斥标签。例如 Class-AB ESSF 可包含 AC 耦合 FVF；两级 CCSF 的“complementary”是级联 PMOS/NMOS，不等同于两个 source 在同一节点汇合的 PPSF。

### 8.2 选择架构时先回答的六个问题

1. 输入是否必须从 DC 开始？若是，不能忽略 AC 耦合支路的低频行为。
2. 负载主要是固定 $C_s$、分布寄生，还是多个交替接入的大电容？
3. 要求高 SFDR 的最高输入频率是多少？不能只给 $f_s$。
4. 可用压头能否让主管、反馈管和 bias 在完整摆幅内正常工作？
5. 输入源可承担多大的电容和非线性电流？
6. 是否允许数字校准静态失真，以及校准是否能跟踪 PVT？

负载小、输入电容紧张时，从裸 SF 基准开始；希望提高低频输出刚度时研究 FVF／SSF；需要大摆幅双向电流时研究 PPSF／Class-AB；高频 HD3 被 $V_{DS}$ 或阱电容限制时研究 bootstrap、body-buffer 或电容补偿；多级采样时必须把浮置输入和历史电荷一起纳入选择。

## 9. 非线性、HD2／HD3 与失真定位

### 9.1 静态多项式：理解谐波的起点

围绕工作点，令 $x=A\cos\omega t$：

$$
y=a_0+a_1x+a_2x^2+a_3x^3+\cdots.
$$

$$
A_1\approx a_1A+\frac34a_3A^3,\qquad A_2\approx\frac12a_2A^2,\qquad A_3\approx\frac14a_3A^3.
$$

$$
HD_2=20\log_{10}\left|\frac{A_2}{A_1}\right|,\qquad HD_3=20\log_{10}\left|\frac{A_3}{A_1}\right|.
$$

这里 HD 使用相对基波的负 dBc 口径；SFDR 通常表示基波与最大杂散之间的正 dB 差值。低失真区域内，输入幅度每升高 1 dB，二次谐波绝对幅度约升高 2 dB、三次约升高 3 dB；相对基波的 HD2／HD3 分别约恶化 1／2 dB。偏离这个斜率说明高阶项、压缩、时变效应或噪声底开始显著。

### 9.2 差分为什么抑制 HD2，却未必压低 HD3

对于完全相同的两支路：

$$
f(x)-f(-x)=2a_1x+2a_3x^3+\cdots.
$$

偶次项消失，奇次项保留。实际差分电路有器件、走线、输入幅度、相位与共模失配，因此 HD2 仍会出现。互补 N/P 对称与正负两支路差分对称是两个不同层次；不能把一种抵消当作另一种已经成立。

差分 HD2 偏大时优先检查：单端源是否对称、共模是否随信号变化、两侧 body 和寄生是否一致，以及采样边沿是否匹配。不要立即把所有电流加倍。

### 9.3 静态失真与动态失真

**静态失真**：足够低频时，$V_{out}=f(V_{in})$ 本身非线性，包括体效应、有限 $r_o$、DIBL、跨导非线性、交越或压头不足。

**动态失真**：与频率、信号斜率、记忆和时钟状态有关，包括电容电流调制、非线性寄生、有限反馈带宽、时钟馈通、未完全建立、耦合网络记忆。

可用示意模型理解二者：

$$
e(t)\approx b_2v^2+b_3v^3+c_1v\dot v+c_2v^2\dot v+d_1\dot v^2+\cdots.
$$

这只是分类工具，不是所有 buffer 通用的闭式模型。高频误差可能同时含输入幅度与导数，纯 DC 三次多项式校准不一定能校正它。

### 9.4 非线性电容为何在 GHz 更突出

若差分电容可展开为 $C(v)=C_0+C_1v+C_2v^2$，则：

$$
i=C_0\dot v+C_1v\dot v+C_2v^2\dot v.
$$

其中 $v\dot v$ 含二次谐波，$v^2\dot v$ 含基波和三次谐波。流经输入源阻抗产生：

$$
v_{err,in}(f)\approx-Z_s(f)i_{nonlinear}(f).
$$

所以不应仅在理想零阻源下证明“buffer 很线性”。对于封装电感较大的输入，非线性门极电流还会通过 $L\,di/dt$ 产生更严重的高频电压扰动。

### 9.5 采样后频谱如何避免认错

连续时间的 $kf_{in}$ 会折叠到第一 Nyquist 区。设：

$$
r=f\bmod f_s,\qquad f_{alias}=\min(r,f_s-r).
$$

高次谐波可能折叠到基波、DC 或同一个 bin。选择测试频率时应避开这些重合。TI 增益／时间偏斜常在 $kf_s/M\pm f_{in}$ 出现杂散；偏置失配常在 $kf_s/M$ 出现杂散。最大杂散不一定是 HD3，SFDR 不等于“第三谐波指标”。

FFT 需分别说明：连续时间 buffer 输出、采样电容保持值、最终 ADC 数字码。应在真实采样时刻抽取有效值，去掉启动段；不能把时钟尖峰、过渡样本或插值误差混入后，再全部归因于 buffer 非线性。

### 9.6 THD、SNR、SNDR 和 SFDR

$$
THD=10\log_{10}\frac{\sum_{k\ge2}P_k}{P_1}, \qquad SNR=10\log_{10}\frac{P_1}{P_{noise}},
$$

$$
SNDR=10\log_{10}\frac{P_1}{P_{noise}+P_{dist}},\qquad SFDR=10\log_{10}\frac{P_1}{P_{spur,max}}.
$$

须规定谐波阶数、频带、窗口与 bin 归属。确定性无噪声 transient 的 FFT 剩余项不能直接当作真实 ADC 噪声底。包含多个谐波的拟合会吸收失真，其残差比值也不能称为完整 SNDR。

若信号幅度为 $L_{sig}$ dBFS，某杂散为 $L_{spur}$ dBFS，则载波参考 SFDR 为 $L_{sig}-L_{spur}$。论文有时使用“SFDR dBFS”表示杂散距满量程的距离；对非满幅输入，它与 dBc 不相同，应保留原口径。

### 9.7 两音与定位实验

两音测试重点检查 $2f_1-f_2$ 和 $2f_2-f_1$ 的 IM3，适合发现带内互调。只有处于弱非线性区、斜率成立、未压缩且未被噪声限制时，才可外推 IIP3。

建议按以下顺序做受控替换：理想源与真实源；固定线性负载与采样负载；理想 bias 与真实 bias；固定 body 与实际 body；理想辅助路径与真实路径；无走线与提取 RC。每次只改变一类机制，并注意替换元件可能改变 DC 工作点。一次仿真改善只能定位嫌疑来源，不能证明所有误差独立可加。

## 10. Bootstrap 与辅助线性化

### 10.1 三种 bootstrap 不要混用

| 类型 | 希望保持不变的量 | 跟随信号的节点 | 主要解决的问题 |
|---|---|---|---|
| 采样开关 bootstrap | $V_{GS,sw}$ 近似恒定 | 开关 gate 跟随 source | 降低 $R_{on}$ 随输入变化 |
| Buffer drain bootstrap | $V_{DS,main}$ 变化小 | 主管 drain 跟随 source | 减弱 $g_{ds}$、DIBL 等引起的调制 |
| Body bootstrap／body buffering | $V_{SB}$ 或阱电容驱动更可控 | body 跟随合适信号节点 | 减弱体效应或转移非线性结电容电流 |

它们可以共存，但目的、频率范围、可靠性约束不同。电容级联传递交流而设置 DC 电平，未必意味着存在周期性充电泵；有源 bootstrap 也不必使用传统开关电容刷新结构。

### 10.2 Drain bootstrap 的误差由两条路径之差决定

设 source 与 drain 的小信号分别为：

$$
v_s=H_s(s)v_{in},\qquad v_d=H_d(s)v_{in}.
$$

$$
\Delta v_{DS}=[H_d(s)-H_s(s)]v_{in}.
$$

因此要同时匹配幅度和相位。若幅度相等但时延相差 $\Delta t$，高频近似 $|\Delta v_{DS}|\propto\omega|\Delta t|\,|v_{in}|$。辅助路径“带宽很高”仍可能留下相位失配；其噪声和失真也会调制主管。

Cascode 的本质不是简单“多堆一只管”。固定栅 cascode 可降低某些节点摆幅；drain bootstrap 则希望节点按特定信号移动。应逐条检查驱动路径，避免把两种机制写成同一件事。

### 10.3 前馈电流补偿（FFC）

主负载需要 $i_L\approx C_L\dot v$。若复制路径提供 $i_{ff}\approx C_C\dot v$，则主管交流电流可近似减为：

$$
\Delta i_{main}\approx i_L-i_{ff}.
$$

理想匹配时 $C_C\approx C_L$，但实际还需匹配开关、电阻、相位与有效负载。时间变化的负载通常不能由一颗固定电容在所有采样相位完全复制。将误差表示为复数比例更有用：

$$
\Delta i_{main}(j\omega)\approx i_L(j\omega)[1-K_{ff}(j\omega)].
$$

其代价是输入或辅助驱动必须提供复制电流。Ali 等 2014 年论文把相对线性的复制电容电流与不希望信号源承受的非线性采样电流区分开；并进一步用 drain bootstrap 控制主管 $V_{DS}$。[原文 §III-A](https://doi.org/10.1109/JSSC.2014.2361339)，Zotero：`88KUWJYB`。

### 10.4 两级 cascade complementary SF

![06_ccsf](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/06_ccsf.png)

*图 6：Li 等，2024，原 Fig. 2，PDF 第 2 页／期刊第 963 页。左为 PMOS SF 级，右为 NMOS SF 级，并包含 drain 跟随、补偿电容和辅助运放。[论文 DOI](https://doi.org/10.1109/TVLSI.2024.3349564)，Zotero：`IZ8STV8W`。*

这里“complementary”指不同极性的两级 SF：前级处理输入和电平，后级驱动重负载。图中输出还通过耦合电容参与前级 drain 调节，因此评估时不能只把它当成两个互不影响的单极点串联。收益是隔离、驱动和补偿任务可分配；代价是噪声累积、更多寄生及辅助回路。

该文 1.9-GHz 输入下 76.6-dB SFDR／58.1-dB SNDR 是**后仿**，不能标成芯片测量。版图面积、偏置功耗及 $0.6\,\mathrm{pF}$ 负载条件同样是比较所需信息。

### 10.5 Body 接 source 之后为何仍有非线性

消除 $V_{SB}$ 变化并未消除 body 到 deep well／substrate 的寄生电容。若 body 与输出相连，这些非线性结电容直接加载输出。它们可能比主负载小得多，却主导高频 HD3。

![05_body_buffer](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/05_body_buffer.png)

*图 7：Scaletti 等，2023，原 Fig. 3，PDF 第 3 页。辅助 follower 驱动主输出管 body，承担相应非线性寄生电容电流。[论文 DOI](https://doi.org/10.1109/NEWCAS57931.2023.10198057)，Zotero：`PKP4WR5K`。*

应检查辅助输出与主 source 的幅相差、DC body 偏置、结是否正向导通、深阱寄生和辅助输入电容。这篇论文采用原理图仿真比较，在其条件下高频 SFDR 改善最高约 6.3 dB；不能将“辅助结构很小”的个案尺寸比例推广到其他 PDK。

### 10.6 Cross-coupled body 不是任意交叉接线

交叉连接可以利用差分或互补节点的相关运动，调整 $V_{SB}$、输出电阻或寄生电容电流。必须依据实际节点的 AC 极性、DC 偏置和结结构判断。正负支路在差模下反相，互补堆栈上某些等效节点却可能同相；“交叉”不代表统一的补偿方向。

![11_body_cross_coupling](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/11_body_cross_coupling.png)

*图 8：Li 等，2025，原 Fig. 6，PDF 第 4 页。该结构在尾电流源等处引入交叉衬底补偿，不能与图 7 的主输出管 body-buffer 当成同一技术。[论文 DOI](https://doi.org/10.1587/elex.22.20250092)，Zotero：`RNRP3VQM`。*

### 10.7 SACC：补偿电流而非继续增加堆栈

![07_sacc](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/07_sacc.png)

*图 9：Cao 等，2024，原 Figs. 13–14，PDF 第 7 页／期刊第 4217 页。小尺寸补偿单元利用相反相位的输入产生补偿电流；曲线是静态仿真。[论文 DOI](https://doi.org/10.1109/JSSC.2024.3482567)，Zotero：`AMZFXGAJ`。*

该文通过小尺寸器件在摆幅较大处产生电流，补偿主 PPSF 的静态非线性。调 bias 改变起作用的位置，调尺寸改变补偿幅度。它提供了一条以电流曲线整形换取较低供电压头的路线。

弱反型电流的工程理解应保留电压尺度：

$$
I_{sub}\propto\frac WL\exp\left(\frac{V_{GS}-V_{TH}}{nU_T}\right), \qquad U_T=\frac{kT}{q}.
$$

指数不能写成带单位电压直接作指数；热电压 $U_T$ 也不要与阈值 $V_{TH}$ 混淆。局部拟合“像三次项”不代表它在整个摆幅及所有温度下恰为三次多项式。跨 PVT 应注明是否每个工艺角重新 trim、是否固定同一套 bias code。

### 10.8 辅助运放的职责应分清

慢速 DC servo 只要稳定内部共模；宽带 bootstrap 驱动器需要匹配 RF 路径；gain-boost 放大器需要在相关频段维持高输出电阻。这三种运放对带宽与噪声的要求完全不同。

把辅助运放理想化后性能大幅改善，可能表明其相位或输出驱动不足，也可能只是其 DC 增益、压摆率或共模范围不合适。应分别观察，不能一概要求“运放 GBW 无限大”。

## 11. 带宽、settling、slew 与稳定性

### 11.1 四种“带宽”要分开

1. 小信号 $-3\,\mathrm{dB}$ 带宽：工作点附近幅度衰减指标。
2. 满功率／大信号带宽：给定大摆幅能否跟踪，受 slew 和工作区限制。
3. SFDR／SNDR 带宽：达到指定动态性能的输入频率范围。
4. 采样系统的有效分辨率带宽：按明确下降条件定义，受前端、时钟和 ADC 核心共同限制。

论文中的 buffer 本体端口带宽、含匹配与封装的系统带宽及整颗 ADC 的动态性能带宽不能直接互换。

### 11.2 多级和多极点

级联两级相同一阶低通时：

$$
H(s)=\frac{A_0}{(1+s/\omega_p)^2},\qquad f_{-3dB,total}=f_p\sqrt{\sqrt2-1}\approx0.644f_p.
$$

两级各有 10-GHz 带宽，总体并不是 10 GHz。额外零点可能补偿幅度，但仍需检验相位、群延迟、噪声增益和时域尾部。对局部反馈的 FVF/SSF，还要包括内部高阻节点极点及耦合电容带来的低频转折。

### 11.3 建立过程拆成三段

$$
t_{available}=t_{sample}-t_{connect,eff},
$$

$$
t_{required}\approx t_{slew}+t_{linear}+t_{tail}.
$$

开关实际导通晚于理想控制边沿；大信号初期可能被电流限制；接近目标后进入线性建立；最后还可能有慢共模、AC 耦合、介质吸收或热响应尾部。各段并非严格互斥，可作为诊断分解。

$$
t_{slew}\gtrsim\frac{C_L\Delta V_{slew}}{I_{available}}, \qquad t_{linear}\approx\tau\ln\frac{e_{start,linear}}{\epsilon}.
$$

误差门限定义为“首次进入并且在采样前保持在误差带内”，避免把欠阻尼振铃第一次穿过目标值当成已经建立。

### 11.4 正弦连续跟踪与阶跃不同

线性一阶通路会对正弦产生增益衰减和相位延迟：

$$
H(j\omega)=\frac{1}{1+j\omega\tau}.
$$

若系统完全线性，增益和相位误差本身不产生 HD2/HD3。真实误差在于 $\tau$ 随输入、负载或时钟变化，以及起始条件的残留。建立分析应给出两种结果：相对理想输入的总误差；去掉统一固定增益与延迟后的非线性／记忆误差。不能为每个周期分别拟合延迟来掩盖采样误差。

### 11.5 Slew-limited 带宽

对于峰值为 $V_p$ 的正弦：

$$
SR_{required}=2\pi f_{in}V_p,\qquad f_{FP}\lesssim\frac{SR_{available}}{2\pi V_p}.
$$

接近这个极限之前，HD3 常已超过要求，因此它是能力上限估算，不是高线性设计边界。正负方向分开计算；Class-AB 的动态电流还受内部控制节点的摆动速度限制。

### 11.6 环路稳定性与系统振铃

FVF/SSF 至少检查局部环路；带 CMFB、replica servo 和有源 bootstrap 时分别检查相关环路及其交互。测试环路时要保留 DC 工作点和两侧加载，选择能反映双向耦合的 loop-gain 测量方法。

工程上可把约 $60^\circ$ 相位裕度作为初步目标，但最终要看过冲、噪声放大及规定误差带内的建立时间。多环路、时变系统或条件稳定电路不能仅凭一个 phase margin 数字签核。

纯 SF／PPSF 虽无额外高增益放大级，也可能因输入源阻抗、寄生电容、封装电感和主动 bootstrap 出现峰化或振荡。应测试实际源／负载范围，而不是只看理想电压源 + 固定电容。

## 12. 噪声与动态范围

### 12.1 输入等效噪声的基本尺度

长沟道、强反型 MOS 的沟道热噪声常近似为：

$$
S_{i_d}(f)\approx4kT\gamma g_m, \qquad S_{v,in}\sim\frac{4kT\gamma}{g_m}.
$$

这里为单边 PSD 尺度关系。真实模型的 $\gamma$、诱导栅噪声及相关项应使用 PDK。尾电流源、辅助反馈管、LS 电阻、replica 和 CMFB 都可能贡献输出噪声；输入等效要除以对应信号传输的模平方。

对理想互补 PPSF，忽略 body 和 bias：

$$
S_{v,out}\approx\frac{4kT(\gamma_Ng_{mN}+\gamma_Pg_{mP})} {(g_{mN}+g_{mP})^2}.
$$

它说明两管都产生噪声也同时降低输出阻抗，不能简单说“多一只 PMOS，噪声翻倍”。但加入实际 bias、源阻抗及带宽后，总积分噪声仍需重新评估。

### 12.2 降低白噪声密度不等于积分噪声同比下降

$$
\sigma_v^2=\int_0^\infty S_v(f)|H_n(f)|^2df.
$$

单极点对白噪声的等效噪声带宽为 $(\pi/2)f_{-3dB}$。若增加 $g_m$ 同时提高噪声带宽，密度下降可能被更宽积分范围部分抵消。不要只截取 1-MHz 处的噪声密度比较高速采样系统。

### 12.3 $kT/C$ 与差分噪声

理想采样电阻充分热平衡后，单个采样电容上的噪声为：

$$
\sigma_{samp}^2\approx\frac{kT}{C_s}.
$$

若两侧采样噪声不相关、每侧电容同为 $C_s$，差分方差约 $2kT/C_s$。$T=300\,\mathrm K$、每侧 $C_s=0.6\,\mathrm{pF}$，每侧约 $83.1\,\mu\mathrm V_{rms}$，差分约 $117.5\,\mu\mathrm V_{rms}$。

这不是完整 ADC 的噪声：还要包括 buffer、采样带宽、后级、参考、抖动等。也不要把已经通过 transient noise 或 sampled PNoise 计算过的开关热噪声，再手动加一遍 $kT/C$。

### 12.4 采样噪声折叠

连续时间宽带噪声经采样后折叠到基带。对于理想瞬时采样和双边 PSD，一个物理频率轴上的等效表达是：

$$
S_{sampled}(f)=\sum_{k=-\infty}^{\infty}S_{CT}(f+kf_s), \qquad -f_s/2\le f<f_s/2.
$$

实际采样窗口和周期时变网络还会改变噪声传递。应采用 sampled PNoise 或含实际时钟的 transient noise，并做噪声频率上限与 sideband 数的收敛检查。连续时间只积分到 $f_s/2$ 往往漏算折叠噪声。

### 12.5 级联噪声与预算

对不相关噪声的两级电压通路：

$$
\sigma_{in,total}^2\approx\sigma_{in,1}^2+ \frac{\sigma_{in,2}^2}{|A_1|^2}.
$$

SF 增益不足 1 时，后级噪声折回输入会放大。共享 bias 或耦合结构可能使噪声相关，应使用交叉谱或完整电路计算。

总允许输入等效噪声由目标 SNR 估计：

$$
\sigma_{allowed}=\frac{V_{rms,in}}{10^{SNR_{target}/20}}.
$$

若分配给 buffer 的是总噪声**功率**的 20%，则 buffer RMS 预算为 $\sqrt{0.2}\sigma_{allowed}$，不是 $0.2\sigma_{allowed}$。失真、离散杂散和随机噪声不总能按互不相关方差直接相加。

### 12.6 抖动与电源噪声

正弦输入、独立小随机时间误差条件下：

$$
SNR_{jitter}\approx-20\log_{10}(2\pi f_{in}\sigma_t).
$$

例如 $f_{in}=4\,\mathrm{GHz}$、仅为抖动分配 60-dB SNR，则 $\sigma_t\lesssim39.8\,\mathrm{fs}$。这个预算属于采样边沿与相关时基的总误差；不能通过增大 buffer 电流自动满足。确定性的边沿调制产生杂散，也不能用白噪声形式全部概括。

PSRR 可定义为 $20\log_{10}|v_{supply}/v_{out}|$，也有按信号增益归一化的定义，应声明口径。RF 输入下的电源扰动还可能调制增益／相位，产生 $f_{in}\pm f_{supply}$ 边带，单纯 DC 工作点上的 AC PSRR 测试可能漏掉这种机制。

## 13. Hierarchical buffer 与多级采样

### 13.1 为什么分层

单个公共 buffer 直接驱动大量子 ADC 时，所有支路走线与 off-switch 寄生会增加总负载。分层可降低每级扇出，将连续时间高频输入采样成保持值，再交给后级分发。

```text
方案 A：Vin → 公共 buffer → 多个交替工作的采样器

方案 B：Vin → 前级 buffer → Rank-1 T/H
                             ↓
                     级间 buffer → Rank-2 T/H → 子 ADC
```

需要区分“连续时间 buffer 树”和“带中间保持的采样树”：前者各层仍处理 RF 连续信号；后者在第一采样边沿之后传递离散值，后级主要承担有限时间建立与隔离。

### 13.2 公共 buffer 与每通道 buffer 的功耗比较

若始终仅一个 $C_s$ 接入，公共 buffer 不必同时驱动 $M C_s$；但它还要驱动路由和关断开关。每通道独立 buffer 可缩短局部走线，却可能使输入看到 $M$ 倍的门极电容及重复静态偏置。

只有知道哪些支路可动态关闭、关闭后是否有启动开销、各级真实负载和占空比，才能比较总功耗。对连续时间正弦驱动，不能套用数字逻辑 $CV^2f_s$ 直接替代偏置和输出电流计算。

### 13.3 浮置保持节点的反向耦合

![13_hold_kickback](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/13_hold_kickback.png)

*图 10：Shifman 等，2019，原 Fig. 3，PDF 第 2 页。前级进入 hold 后，后级 buffer 输出继续移动，通过输入输出寄生电容改变已保持输入。[论文 DOI](https://doi.org/10.1109/A-SSCC47793.2019.9056969)，Zotero：`MQDUICAW`。*

对简单两个电容模型：

$$
\Delta v_{held}\approx\frac{C_{io}}{C_H+C_{io}}\Delta v_o.
$$

若 $C_{io}\ll C_H$，约为 $(C_{io}/C_H)\Delta v_o$。这个误差取决于上一级采样结束时下一级尚未完成的运动量，可能携带前一轮数据或前一通道信息。

扩大保持电容可降低耦合比例，却增加前级驱动；减小 $C_{io}$ 可降低误差，却可能降低 $g_m$；增加提前建立时间需重新设计时序。正负交叉电容可补偿一部分差分耦合，但必须验证负载不对称及共模路径。

### 13.4 分层并不消除所有 mismatch

若所有后级通道看到同一个已稳定保持值，后级采样时刻差异对原始 RF 斜率的敏感度可降低。但保持值尚在建立、存在 droop、不同级间路径有 gain／offset／memory 差异时，仍然产生误差。前级有多个交织采样器时，其 RF timing／BW mismatch 也仍存在。

### 13.5 动态 buffer 与预开启

![09_hierarchy_interface](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/09_hierarchy_interface.png)

*图 11：Markulić 等，2024，原 Fig. 2，PDF 第 2 页。分裂采样电容、电平设置、动态 PP-SF 和后级采样协同工作。[论文 DOI](https://doi.org/10.1109/VLSITechnologyandCir46783.2024.10631521)，Zotero：`GHM37WIL`。*

![08_hierarchy_timing](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/08_hierarchy_timing.png)

*图 12：同文原 Fig. 3，PDF 第 2 页。时钟、分布电容及布局共同决定实际 charge transfer 时间。图 11 与图 12 配合阅读。*

该设计在 reset 阶段预先使动态 buffer 进入准备状态，采样后立即转移电荷，避免把短窗口浪费在启动上。第二级采样完成后再转高阻状态节省功耗。这类技巧要求同时验证：预充电是否引入输入相关误差、开关先后次序、关断残留电荷、动态 bias 恢复，以及所有输入序列下的有效时间。

### 13.6 输入缓冲链的记忆模型

可用简化模型定位残留：

$$
y[n]=a_0x[n]+a_1x[n-1]+a_Mx[n-M]+\cdots.
$$

固定线性系数形成频响变化；当系数依赖信号、通道、时钟或温度时，会出现更复杂的失真与杂散。大步进交替序列、PRBS、长时间 DC 后突发以及不同通道访问顺序，比单一低频正弦更容易暴露记忆问题。

## 14. THA／采样网络协同

### 14.1 真正的输出是采样电容上的值

Buffer 输出很好，不代表采样值准确。应同时保存：pad 电压、buffer 输入、buffer 输出、开关两端电压、采样电容的两极电压、$V_{GS,sw}$、时钟以及最终保持差分值。对 bottom-plate sampling，真正被保留的是电容两端电压／电荷，单看某一极对地电压会误判。

### 14.2 开关导通电阻

长沟道、小 $V_{DS}$ 的近似：

$$
R_{on}\approx\frac{1}{\mu C_{ox}(W/L)(V_{GS}-V_{TH})}.
$$

Bootstrap 保持 $V_{GS}$ 近似恒定，可以减少电阻随输入变化，但 $V_{TH}$ 仍可能受 body/DIBL 调制，$C_{boot}$ 也会发生电荷共享。开关尺寸增大降低 $R_{on}$，同时增加栅驱动、clock feedthrough、off-state 电容及 buffer 负担。

### 14.3 Track 窗口不能只看理想时钟

$$
t_{track,eff}=t_{aperture}-t_{on,eff}.
$$

$t_{on,eff}$ 包含 bootstrap 开启延迟以及达到低 $R_{on}$ 所需的过程。若名义 track 为 $100\,\mathrm{ps}$，开启损失 $25\,\mathrm{ps}$，用于建立的窗口已减少四分之一。论文中的 fast turn-on、layout-customized bootstrap 正是在减少这部分开销。

### 14.4 保持阶段与 feedthrough

Hold 时输入仍继续变化，经 $C_{off}$ 或开关寄生耦合到采样节点。第一 Nyquist 区看似不显著的耦合，在多十 GHz 欠采样时可能恶化明显。应测试长 hold 时间、多个输入周期在 hold 内经过，以及后级开关对保持节点的反向扰动。

### 14.5 有源 bootstrap：主信号与 gate 驱动同时跟踪

![10_active_bootstrap](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/10_active_bootstrap.png)

*图 13：Heel 等，2025，原 Fig. 9，PDF 第 7 页。主 buffer 驱动被采样信号，辅助 buffer 驱动 gate 跟踪路径，通过不同供电／偏置设置近似恒定的开关 $V_{GS}$。[论文 DOI](https://doi.org/10.1109/JSSC.2025.3598874)，Zotero：`62CPDB27`。*

关键是 $H_{gate}(j\omega)-H_{signal}(j\omega)$ 足够小，而非仅仅两个通路都有很高 $-3\,\mathrm{dB}$ 带宽。该论文专门针对高 Nyquist 区输入：即使一次接通过渡已衰减，仍可能无法准确跟踪很快的 RF 信号，所以 tracking 与 settling 必须分别评估。

### 14.6 SHA-less：flash 与 MDAC 的孔径匹配

SHA-less pipeline 中，sub-ADC 和 MDAC 分别看输入，它们的采样时刻与模拟频响必须匹配。近似时间差导致：

$$
e_{aperture}\approx\frac{dv_{in}}{dt}\Delta t.
$$

即使两条理想时钟同步，输入 RC 或 buffer 路径不同，也会形成等效采样差。应比较实际采样值及残差范围，并验证 redundancy 是否足以吸收错误，而不是只调逻辑时钟延迟。

### 14.7 Reset、dither、参考与 buffer 的相互作用

电容保留上一周期 DAC 电压，会使下一次接入电流与旧码相关。Reset 可减小这种记忆，却占用建立窗口并增加时钟功耗。Dither 可能用于校准或将某些确定性误差打散，但也增加输入或参考端瞬态负载。

若补偿通过同时调制采样电容另一极的共模实现，buffer 输出对地波形可能并未完全线性，而最终采样差分电压得到补偿。这正是 replica-to-CM 类方案的系统协同价值，不能只按单个输出节点的 THD 判断。参见 `E4HP4VRY`。[论文 DOI](https://doi.org/10.1016/j.mejo.2025.107015)

## 15. S 参数与输入匹配

### 15.1 什么时候需要 S 参数

当 PCB、封装、输入匹配与信号频率使传输线、反射、寄生电感显著时，单一 $R_s+C_{in}$ 不足以描述输入。S 参数用于有规定参考阻抗及工作点的线性小信号网络。

$$
\begin{bmatrix}b_1\\b_2\end{bmatrix} =\begin{bmatrix}S_{11}&S_{12}\\S_{21}&S_{22}\end{bmatrix} \begin{bmatrix}a_1\\a_2\end{bmatrix}.
$$

实数参考阻抗 $Z_0$、其余端口匹配时：

$$
S_{11}=\frac{Z_{in}-Z_0}{Z_{in}+Z_0},\qquad Z_{in}=Z_0\frac{1+S_{11}}{1-S_{11}}.
$$

### 15.2 指标含义

| 参数 | 物理问题 | 常见误解 |
|---|---|---|
| $S_{11}$ | 输入反射和匹配 | 更小的反射不自动等于更高 SFDR |
| $S_{21}$ | 规定端口条件下正向波传输 | 不等于高阻探测下的电压增益 |
| $S_{12}$ | 小信号反向传输 | 不足以量化大信号 clock kickback |
| $S_{22}$ | 输出端反射 | 内部电容负载输出通常不以 50 Ω 匹配为目标 |

Return loss 定义为：

$$
RL=-20\log_{10}|S_{11}|.
$$

例如 $S_{11}=-10\,\mathrm{dB}$（幅度 dB 表示）意味着反射波幅度约 0.316、功率约 10%，return loss 为正 10 dB。端口电压要考虑入射和反射，不能把 dB 值直接当作输入电压衰减。

### 15.3 差分 mixed-mode 参数

两端口差分通路通常从四个物理单端端口构建。常用：$S_{dd11}$（差模反射）、$S_{dd21}$（差模传输）、$S_{cd21}$（差模输入转为共模输出）及 $S_{dc21}$（共模输入转为差模输出）。下标先输出模式、后输入模式。

每个单端参考为 $50\,\Omega$ 时，常用差模参考为 $100\,\Omega$、共模参考为 $25\,\Omega$，但必须以工具的波归一化和端口设置为准。记录端口配对与正负极性，避免把 $S_{dc}$ 和 $S_{cd}$ 互换。[Keysight 官方 mixed-mode 说明](https://helpfiles.keysight.com/csg/FieldFoxOnlineSupplementalHelp/Concepts/Balanced_Measurements.htm)

### 15.4 匹配、峰化与线性一起看

并联终端电阻有助于匹配和降低输入扰动，但消耗信号功率并产生热噪声；电感／T-coil 可利用寄生扩展带宽，也可能带来峰化、群延迟变化与电压过冲。极高频下可以优化 $C_{pad}$、$C_{ESD}$ 与 $C_{buf}$ 的位置，而非把它们全堆在一个节点。

Heel 等 2025 年设计将输入网络与 PPSF、有源 bootstrap 联合优化；其摘要报告输入 $S_{11}<-12\,\mathrm{dB}$ 至 35 GHz，属于该前端的实测条件，不能归功于一个独立 buffer。[论文 DOI](https://doi.org/10.1109/JSSC.2025.3598874)

### 15.5 时变采样网络的边界

静态 AC／SP 可以测 track 冻结状态或 hold 冻结状态，却不能完整描述周期性开关网络的频率转换。时钟接通时的同频响应之外，还有采样频率的边带转换。需要根据仿真器能力使用 PSS/PAC、周期小信号或相应转换矩阵，并用 transient 的实际采样值验证。

导入封装／走线 `.sNp` 时检查参考面、阻抗、端口顺序、频率范围、因果性和适用于被动互连的无源性；做去嵌时防止把已经包含在提取模型中的 pad、bondwire 再加一次。主动 buffer 本体不能拿被动网络的无源性条件直接判断好坏。

## 16. 技术演进与论文案例

### 16.1 技术演进是并行路线，不是单一替代链

| 时期／代表资料 | 主要矛盾 | 代表思路 | 遗留问题 |
|---|---|---|---|
| 基础 SF 与早期分析 | 单管有限跨导、体效应和负载调制 | 增加驱动，分析并控制二阶效应 | 功耗、输入电容与摆幅 |
| FVF、SSF 及其基础研究 | 低功耗下压低输出阻抗 | 主管恒流化与局部反馈 | 压头、内部节点、单方向 slew |
| 2010／2014 复制电流与 drain 跟随 | 高分辨率采样负载造成非线性电流 | FFC 与 bootstrap | 复制支路负担和高频幅相误差 |
| 2017 多 GS/s 互补前端 | 交织采样的双向驱动和 RF 线性 | 电流复用 PPSF、多层 drain/body bootstrap | 高电源、off-switch 寄生 |
| 2019 差分 Class-AB SSF | 嵌套采样的低功耗、PSRR、ISI | 动态转向、内部 DC 调节、交叉耦合 | 具体时序及浮置输入敏感性 |
| 2020 集成 THA | 大交织因子的高频失配和扇出 | 在早期固定采样瞬间，再分发保持值 | memory、后级非线性与校准 |
| 2022 AC 耦合 FVF | 经典 FVF 摆幅不足 | 解耦 DC bias 与 AC 反馈，寄生补偿 | 低频覆盖、耦合电容、环路 |
| 2023／2024 精细线性化 | 非线性阱电容与低压静态 HD3 | body-buffer、CCSF、SACC | 辅助路径误差、trim 与 PVT |
| 2024 分层动态接口 | 大 $C_s$ 与大量通道的功耗 | 分裂采样、预开启、局部分配电荷 | 时序及 charge sharing |
| 2025 高 Nyquist 区前端 | 多十 GHz 输入，$f_{in}$ 远高于 $f_s/2$ | 输入匹配 + PPSF + 有源 bootstrap | 路径幅相匹配、孔径抖动、EM |
| 2025／2026 复合与系统补偿 | 压头、动态电流及最终采样误差 | Class-AB ESSF、replica-to-CM、switched buffer | 实测证据、校准边界、工艺依赖 |

这些时间点是本次文献集中的代表性节点，不能据此断言某机制由所列论文首次发明。SF 仍可作为复杂架构的基本单元；FVF/SSF 没有被 PPSF 全面取代。

### 16.2 关键案例与正确的性能口径

| 文献／Zotero key | 关注机制 | 可核实条件及结果 | 证据边界 |
|---|---|---|---|
| Devarajan 2017，`JI8G84VA` | 多层 bootstrap PPSF，公共 buffer 驱动 8 路采样器 | ADC 12 b、10 GS/s；buffer 约 400 mW；$+2/-1$ V 供电 | 芯片系统实测；完整功耗与性能须看 ADC 条件 |
| Shifman 2019，`MQDUICAW` | 差分 Class-AB SSF，位于 TH1/TH2 之间 | 波形测量拟合约 9.7-GHz BW；低频 PSRR 43 dB；文中报告差分功耗 1.64 mW，表格单支路为 0.82 mW；负载 0.2 pF | 有硅片波形／PSRR 测量；不能把摘要的全部数字都当作独立仪器直接测得，功耗表含仿真脚注 |
| Ali 2020，`3ILPCVZH` | THA + 输入／输出 PPSF + memory 校准 | 12-b、18-GS/s RF ADC；前端采样网络可重配置 | 系统实测；输出 buffer 失真与 memory 由校准协同处理 |
| Huang 2022，`B5HLXYYN` | AC 耦合 FVF + 非线性电容补偿 | buffer 137 mW；ADC 8 GS/s；3.9-GHz、−1-dBFS 输入下 SNDR 54.9 dB，SFDR 约 68 dBFS | ADC 实测；不同 buffer 配置改善量为仿真，dBFS 保留原口径 |
| Scaletti 2023，`PKP4WR5K` | 辅助 body buffer | 28 nm；$+1.8/-1$ V；约 38 mW；2-GS/s 采样；1.4-Vpp,diff；近 Nyquist 改善最高 6.3 dB | 原理图／QPSS 仿真；无硅片性能承诺 |
| Li 2024，`IZ8STV8W` | 两级 CCSF + 前馈／辅助运放 | 65 nm；2.5 V；4 GS/s、0.6 pF；1.9-GHz 输入，SFDR 76.6 dB、SNDR 58.1 dB、27 mW | 后仿；包含采样与封装模型、transient noise |
| Cao 2024，`AMZFXGAJ` | SACC 低压 PPSF + global dither | buffer 24 mW；供电跨度 1.2 V；整颗 ADC 12 GS/s、179.8 mW、近 Nyquist SNDR/SFDR 54.1/66.0 dB | ADC 实测；buffer THD/PVT 图为仿真，区分重新 trim 与固定 code |
| Markulić 2024，`GHM37WIL` | 分层采样与动态 buffer 接口 | 整颗 10-GS/s ADC 350 mW；低频／Nyquist 9／8.2 ENOB | 系统实测；不能把 350 mW 标成独立 buffer 功耗 |
| Heel 2025，`62CPDB27` | 输入网络 + 双 PPSF 有源 bootstrap | 前端 12.8 GS/s、38-GHz 输入 BW、1–32 GHz 内 SNDR >39 dB；前端 87 mW | 多芯片前端测量，后级读出／噪声口径见原文；不是完整高分辨率 ADC 的同条件对比 |
| Guo 2025，`DLDWSRMX` | Class-AB ESSF + AC 耦合 FVF 双环 | 28 nm；1.4 V；0.5 pF；15.53-GHz 输入，SNDR/SFDR 58.8/63.6 dB、47.2 mW | 后仿，面积脚注不含 bias；不可与实测 ADC 直接排名 |
| Li 2026，`E4HP4VRY` | 复制非线性电流至采样共模端 | 整颗 14-b、3-GS/s ADC；109.3-MHz 输入下 SNDR/SFDR 61.08/75.93 dB；总功耗 1.4 W | ADC 实测；低频结果不是 Nyquist 结果，会议版本 `4VVZMRMD` 不重复计数 |

### 16.3 从案例提炼可迁移的设计方法

**2017 PPSF 案例**：先确定公共扇出负载，再分配主跟随管和外层 bootstrap 的非线性电流路径，最后协调快速采样开关。可迁移的是路径分析；不可直接复制的是电源、电流和全部尺寸。

**2022 FVF 案例**：先找经典结构中限制输出的 DC 电位绑定，再用交流耦合释放偏置选择；继而观察剩余非线性电容。可迁移的是偏置／反馈拆分；不可忽略的是原设计的输入频率下限。

**2024 SACC 案例**：先用静态电流不平衡定位三次失真，再用小单元形成补偿曲线，最后验证高频与 PVT。不能把有限幅度内的弱反型补偿称为严格全局多项式抵消。

**2025 欠采样案例**：同时约束 buffer 输入电容、输出阻抗、匹配网络、gate 跟随路径及抖动；最高输入频率远高于 Nyquist，必须单独验证 tracking。提高普通阶跃建立速度不等价于提高多十 GHz 信号保真度。

### 16.4 新文献中的证据警惕点

标题中有 “ADC” 或正文有版图，不代表报告了芯片测量。`QRCJT5DZ` 的摘要明确为 simulation results；`DLDWSRMX` 明确为 post-layout；`RNRP3VQM` 含 200 次 Monte Carlo 和后仿图。分类索引记录这些论文的主题，但不把所有标题中的 SFDR／SNDR 汇成跨文献排行榜。

## 17. 可执行的设计流程

### 17.1 步骤一：写需求表和边界

给出：$f_s$、$f_{in,max}$、输入频率下限、信号幅度、共模、所需 SFDR/SNDR、允许功耗、可用电源和器件类型、外部 $Z_s(f)$、$C_s$、TI 相位与重叠关系。必须写清楚误差在 buffer 端口还是最终采样节点验收。

输出物：一页规格表、一个统一 testbench、统一的 FFT／噪声计算口径。

### 17.2 步骤二：画真实采样负载和时序

将 track、hold、reset、DAC、dither 分相绘制；给每个相位建立负载等效图。标明采样前后电容电压初值及真正 aperture 边沿。提取或预估实际走线，算“可用建立时间”，而不是“时钟半周期”。

输出物：相位负载表、最坏 $\Delta Q$、有效时间、输入源与 package 模型。

### 17.3 步骤三：一阶算电流、阻抗和噪声

分别算 $2\pi fCV_p$、$C\Delta V/t$、$\tau<t/\ln(\Delta V/\epsilon)$、噪声预算及抖动预算。用这些结果筛掉明显不可能的电路／电源组合，而不是直接得出最终晶体管尺寸。

### 17.4 步骤四：建立 SF 与 PPSF 基准

在同一真实负载、同一输入源、相同输出摆幅下比较。若等功耗，计入所有 bias 和 level shift；若等 $R_{out}$，记录输入电容和电源差异。用基准判断瓶颈是驱动不足、$V_{DS}$ 调制、body、寄生电容还是采样开关。

### 17.5 步骤五：选择局部反馈或补偿

若瓶颈是小信号输出刚度，研究 FVF/SSF；若大信号一方向受限，研究 Class-AB/PPSF；若主管端电压调制突出，研究 drain bootstrap；若输入或 body 寄生主导，研究电流路径转移或补偿。只有机制被定位后，才增加相应支路。

### 17.6 步骤六：确定工作点与尺寸

通过 PDK 扫描选择 $L$、器件类型、电流密度与 body bias。先满足全信号范围内的工作点和可靠性，再调 $g_m$、输入电容和反馈比。保存每次选择的原因，例如“为降低输入非线性电流而减小外层管”或“为保持最坏低电源裕量而移动共模”。

### 17.7 步骤七：先做机制消融，再做全频扫描

对 bootstrap／FFC／body compensation 等做有无对照，保持可比工作点和功耗。扫描幅度、输入频率、输出共模、源阻抗、负载；观察 HD2、HD3、IM3、$V_{DS}$ 和电流。某一频点的最优偏置可能是两种误差相消，不代表宽带稳定。

### 17.8 步骤八：接回完整采样网络

加入真实时钟开启、reset、hold 与 TI 相位，按 aperture 抽取保持值。以多种历史序列检验 memory、kickback、采样错误及跨通道串扰。逐项解释与理想负载测试的差异。

### 17.9 步骤九：PVT、失配与布局迭代

先找明显危险角，再加 Monte Carlo；在布局早期提取关键节点和长线，避免后仿阶段才发现 bootstrap 高频路径无法匹配。验证完整电源／时钟网络，而不只验证信号核心。

### 17.10 步骤十：签核与可复现记录

每个最终指标保存电路版本、PDK 版本、corner、温度、电源、输入、时钟、负载、输出节点、FFT 设置、校准状态及仿真选项。选定有意义的余量，并说明哪些余量来自 PVT／统计验证，哪些仍是经验假设。

### 17.11 一个连贯的起步算例

**假设**：12-bit 目标、总采样率 8 GS/s、最高输入 4 GHz、差分输出 1.2 Vpp、每侧有效负载 0.6 pF、建立时间 100 ps。无具体 PDK。

| 项目 | 起步估算 | 对设计的含义 |
|---|---|---|
| 每侧正弦峰值电流 | 4.52 mA | 静态偏置和 Class-AB 动态能力均须覆盖，并留线性余量 |
| 满幅阶跃 0.5-LSB 一阶极点 | >14.34 GHz | 只是固定目标的初筛，真实多极点要更仔细 |
| 总等效充电电阻 | <18.5 Ω | 如果开关和走线为 10 Ω，buffer 只剩约 8.5 Ω 的简化预算 |
| 对应 PPSF 总跨导 | 约 >118 mS | 由 $1/8.5\,\Omega$ 得到，忽略其他电导；不是最终 $g_m$ 指标 |
| 每侧采样热噪声 | 83.1 µV RMS | 两侧独立时差分约 117.5 µV，另加其他噪声 |
| 4-GHz 输入下 60-dB 抖动预算 | <39.8 fs RMS | 时钟和实际采样边沿同等关键 |

若 $g_m/I_D$ 暂按 $12\,\mathrm{V^{-1}}$，PPSF 两管均达到该值时，$g_{mN}+g_{mP}\approx24I_B$，对应 $I_B\approx4.9\,\mathrm{mA}$。这个偏置已与负载峰值同量级，不能据此承诺高线性；要扫大信号电流与总跨导变化。若为了降低失真继续加电流，输入电容和功耗会成为新约束，可能促使转向补偿、反馈或减小有效负载。

这套预算刻意展示“约束是否互相矛盾”，不意味着这个假设系统必须采用 PPSF。若可用时序、满幅阶跃假设或噪声分配变化，结论也会变化。

## 18. PVT、Monte Carlo 与 post-layout

### 18.1 PVT 验证什么

Process 改变迁移率、阈值、$g_{ds}$、寄生及电阻／电容；Voltage 改变压头、偏置和动态电流；Temperature 改变迁移率、阈值、噪声、泄漏与电阻。因此“SS 最坏速度，FF 最好速度”只能作初步直觉，互补不对称角 FS/SF 常更容易暴露交越、共模和失真。

应覆盖实际可用角：TT、SS、FF、FS、SF，电源上下限及温度范围；器件角与互连 RC 角按 PDK 合法组合使用。高温泄漏可能改变 AC 耦合节点的 DC 位置，低温也可能改变弱反型补偿的有效范围。

### 18.2 失配与全局工艺变化分开

Monte Carlo 至少区分 global process variation 与 local mismatch，按工艺模型的相关性运行，不能自己给每个参数任意独立随机扰动。关注：N/P 或两差分支路的偏置失衡、内部高阻节点、LS 电阻比、电容补偿比例、body 路径，以及实际输出 SFDR／SNDR。

如果 bias 可 trim，应至少报告两种情况：所有样本同一组 code；每个样本按实际可执行流程 trim 后。不能在每个 corner、每个输入频率重新人工调到最优，然后称为“无校准 PVT robust”。

### 18.3 样本数与统计结论

平均值与标准差不足以描述削顶、启动失败等长尾事件。记录失败率、最坏样本波形和分位数；给每个样本设置客观通过条件。约 100–200 次样本可用于观察趋势，不自动证明极高良率。

若 $n$ 次独立样本零失败，失败概率的约 95% 单边上界可粗估为 $3/n$。例如 200 次零失败仍只支持约 1.5% 的失败率上界量级，不能宣布 ppm 级良率；此外模型本身和覆盖条件也限制结论。

![12_pvt_mc](/GarveyDing_AcademicPages/images/blog/learning-notes/high-speed-adc-input-buffer/12_pvt_mc.png)

*图 14：Li 等，2025，原 Figs. 12–13，PDF 第 5 页，包含 PVT 与 200 次 Monte Carlo。该图展示报告形式和特定条件下的分布，不是本文运行的仿真，也不是芯片良率证明。[论文 DOI](https://doi.org/10.1587/elex.22.20250092)，Zotero：`RNRP3VQM`。*

### 18.4 Post-layout 应按增量定位

推荐依次加入：器件寄生 → 局部互连 RC → 信号扇出与耦合 → bias／供电 RC → package／PCB → 必要的 EM 模型。对每一步记录带宽、失真、噪声、最小裕量及建立变化。

某一版提取后失真明显增加，要比较内部 bootstrap 节点与主管 source 的幅相差；不要只比较输出 $-3\,\mathrm{dB}$ 带宽。长线对两条路径的相位差，即使对各自幅度影响很小，也可能破坏原理图中的抵消。

### 18.5 仿真数值收敛也是证据的一部分

窄 aperture 和高次谐波要求足够小的时间步长及准确插值；以减小最大步长、收紧容差后关键指标变化足够小作为判据。改变 FFT 记录长度检查窗泄漏和噪声底；改变 transient noise 频率上限、PNoise sideband 数检查噪声收敛。

在 PSS/QPSS 中，多个不公度信号和长重复 PRBS 可能使问题很大。可先用简化周期模式定位，再用长 transient 检查真实工作序列；不要把求解器“收敛”当成性能验证完成。

### 18.6 启动、停止和过载恢复

检查 supply ramp、bias 建立顺序、时钟先于模拟电源或晚于电源、长静默、突发输入、信号过载后回到正常范围。AC 耦合和 replica/CMFB 可能存在长时间常数、错误稳态或饱和恢复。器件电压裕量与可靠性应覆盖这些瞬态，而非仅稳定正弦周期。

## 19. 版图与封装注意事项

### 19.1 先保护高频电流回路

主驱动管、局部去耦、采样器与地回路应尽量紧凑。低 $R_{out}$ 本体串上一段明显走线电阻后，系统仍会变软；大电流通过共享回路会调制其他支路。检查平均、峰值及 RMS 电流密度，以及允许的电迁移规则。

### 19.2 输入节点以少电容、少非线性电流为目标

Pad／ESD 到主 gate 的线尽量短，并控制与时钟、数字线的耦合。更宽线减电阻但可能增加对地和耦合电容，需结合提取优化。栅极多指布局、两端接触和 gate strap 可减小栅电阻，但也改变寄生；不能只按总 $W$ 认为等价。

### 19.3 差分匹配不只是镜像

两侧走线层、长度、过孔、转角、邻近电源／时钟环境与 dummy 应一致。RF 路由匹配与低频器件 common-centroid 有时冲突：复杂交叉线可能增加寄生和不对称，应比较提取后效果。共模采样节点、body 接触和阱边界也属于差分匹配的一部分。

### 19.4 Bootstrap／反馈节点

感测高阻节点宜紧凑，避免让其驱动长线和大栅电容。匹配主信号与辅助路径的电气长度、寄生负载及回流路径。电容上下极板寄生和连接方向影响耦合系数，布局时应按真实端口处理；MIM/MOM 电容并非完全没有电压依赖与损耗。

### 19.5 Body、well 与 guard ring

明确每个 well 的归属、电位及可移动范围，使用足够接触减小体电阻。Guard ring、deep N-well 有利于隔离，但会增加面积和结电容；要让其电容出现在正确的驱动节点。检查所有源漏／阱结在正常、启动、掉电及过冲下的偏置。不要将 FDSOI back-gate 的经验直接应用于 bulk 深阱。

### 19.6 电源、bias 与热梯度

动态输出电流不应穿过精密 bias 参考的长共用金属；局部去耦必须评估返回路径与谐振。LS、CMFB 和 replica 远离强时钟，且保持合适热环境。大功率 buffer 自热会引起局部 $V_{TH}$、迁移率和匹配变化，静态全芯片温度角未必覆盖全部热梯度。

### 19.7 封装与 EM 联合验证

bondwire／bump 电感、输入 pad 电容、回流地及邻近引脚互感可改变输入电压和 kickback。对高频电感／T-coil、长互连及大电流回路采用适当 EM 提取，检查匹配、峰化、群延迟和器件端电压。几何尺寸接近相关电长度时，用分布模型替代纯 lumped RC。

## 20. 仿真 checklist

以下为可复制到项目中的验收表。所有“通过”均须有对应条件与波形／数据，本文未替任何具体电路勾选。

### 20.1 规格与 testbench

- [ ] 定义单端／差分满量程、输入／输出共模和测量节点。
- [ ] 分开规定 $f_s$、每通道速率、$f_{in,max}$、频率下限与 Nyquist 区。
- [ ] 记录 pad、ESD、源阻抗、package、routing、on/off-switch、$C_s$、辅助负载。
- [ ] 定义有效 track 时间、实际 aperture 边沿、reset／hold／dither 时序。
- [ ] 规定 SFDR 的 dBc/dBFS、HD 符号、噪声积分范围和校准状态。
- [ ] 统一功耗边界，包含差分两侧、bias、CMFB、bootstrap 及供电开销。

### 20.2 DC 与器件状态

- [ ] 输入从最小到最大扫过，检查 $V_{out}$、增益曲线、偏置电流及共模。
- [ ] 所有关键管记录 $V_{GS}$、$V_{TH}$、$V_{OV}$、$V_{DS}$、$V_{DSAT}$、$g_m$、$g_{ds}$。
- [ ] PMOS 参数转换成一致方向，避免直接比较两个负值造成误判。
- [ ] 检查 body 结偏置、最大端间电压及电源跨度，而不只看 $V_{DS}$。
- [ ] 检查高阻感测节点是否因失配漂移，replica/CMFB 是否具有有效控制范围。

### 20.3 AC／SP／环路

- [ ] 从 source→pad→buffer→采样节点分别测增益、相位和带宽。
- [ ] 测 $Z_{in}(f)$、$Z_{out}(f)$，声明实际源和负载条件。
- [ ] 测主路径与 drain/body/gate bootstrap 路径的幅相差。
- [ ] 检查每个局部环路、共模环路、bias servo 的稳定性及交互。
- [ ] 使用正确端口参考阻抗和 mixed-mode 配对，检查 $S_{dd11}$、模式转换。
- [ ] 扫源阻抗与负载范围，检查峰化、振铃和条件稳定性。

### 20.4 Transient 与建立

- [ ] 小阶跃、大阶跃、正负方向分别测试；记录进入并保持在误差带内的时间。
- [ ] 用 $i_N/i_P$ 或供电／吸电流支路判断 slew 与 Class-A/AB 状态。
- [ ] 瞬态保存最小饱和裕量与内部节点恢复，覆盖大摆幅、高频及低电源。
- [ ] 使用实际开关和 bootstrap，统计真实有效 track 时间。
- [ ] 采样前后检查 charge sharing、clock feedthrough、reset 残余与 hold droop。
- [ ] 用大步进交替、PRBS、DC 后突发与通道切换序列检查 memory/ISI。
- [ ] 检查启动、时钟停止／恢复、过载及电源异常时序后的恢复。

### 20.5 频谱与噪声

- [ ] 全频段扫描 HD2、HD3、THD、SFDR，覆盖目标 Nyquist 区。
- [ ] 幅度扫描检查弱非线性斜率、压缩和交越行为。
- [ ] 两音检查 IM3 与带内互调，避免混叠重合。
- [ ] 分别分析连续 buffer 输出、采样保持值和 ADC 数字码。
- [ ] 采用相干采样或合适窗函数，并记录有效样本数、去启动段和 bin 规则。
- [ ] 不把无噪声仿真的数值底噪／拟合残差称作真实 SNDR。
- [ ] 积分器件、bias、LS、CMFB 和源噪声；检查采样折叠，避免重复加 $kT/C$。
- [ ] 检查电源噪声引起的输出噪声及 RF 载波边带。
- [ ] 改变步长、容差、噪声上限、sideband 数和记录长度，验证指标收敛。

### 20.6 PVT、Monte Carlo、后仿与交付

- [ ] 覆盖 TT/SS/FF/FS/SF 等合法角，供电与温度上下限及互连角。
- [ ] 分开做 process/mismatch，记录随机种子、样本数、分位数和失败条件。
- [ ] 区分固定 trim code、逐芯片校准与逐 corner 重新优化。
- [ ] 对失效样本保存完整工作点和瞬态，定位截止、失稳、压头或补偿失配。
- [ ] 分阶段加入提取 RC、耦合、package 与 EM 模型，解释性能变化。
- [ ] 校核 IR drop、电迁移、自热、器件可靠性与实际 ESD 约束。
- [ ] 以最终采样值验收，并保留可复现设置、网表版本、脚本与报告。

## 21. 常见误区与调试索引

| 现象／说法 | 更准确的判断 | 优先检查 |
|---|---|---|
| “所有管饱和，线性应当很好” | 饱和不是恒定 $g_m/g_{ds}/C$ | $V_{DS}$、body、电流变化及高频电容 |
| “$V_{DSAT}$ 就是 $V_{GS}-V_{TH}$” | 只在特定简化模型下近似 | PDK 模型定义和实际 operating point |
| “FVF 的 $R_{out}$ 最小，所以一定最快” | 有效反馈频段和内部极点限制速度 | $Z_{out}(f)$、loop gain、真实瞬态 |
| “FVF 充放电都强” | 经典结构可能一个方向仍由 $I_B$ 限制 | 正负 slew、分流管截止 |
| “PPSF 就是反相器” | source 汇合与 drain 汇合不同 | 晶体管连接、LS 及输入输出极性 |
| “PP 一定优于 SF，且一定省一半电” | 取决于负载、输入电容、bias 和供电 | 相同输出条件下完整功耗比较 |
| “Body 接 source 后寄生非线性消失” | 阱／基底电容可能转为输出负载 | 非线性结电流路径与阱结构 |
| “$g_m$ 越大带宽越高” | 输入电容、内部节点也会改变 | 输入端极点及 $g_m/C$ |
| “低频 HD3 好，高频也应当好” | 动态电流、寄生与相位失配会主导 | 频率扫描和节点电流频谱 |
| “独立 buffer 仿真很好，ADC 一定好” | 采样开关和记忆改变误差 | aperture 保持值、完整时钟和真实源 |
| “AC 耦合补偿适合所有输入” | 低频或突发下可能失效 | 频率下限、基线恢复与启动 |
| “100 次 MC 没失败，良率有保证” | 统计置信度和覆盖仍有限 | 样本数、失败定义、长尾和模型 |
| “一张谱图证明 80-dB 线性” | 可能是单频相消、理想源或无噪声结果 | 频率、幅度、PVT、源阻抗及证据类型 |
| “分层后 timing mismatch 没了” | 只在已稳定保持值的后级较不敏感 | Rank-1 孔径、后级建立、droop 和 memory |

### 21.1 设计评审时的十个追问

1. 这个架构真正降低的是哪一段误差传输？
2. 最坏负载电流由谁提供，其回流路径在哪里？
3. 每个主管的 $V_{GS}$、$V_{DS}$、$V_{SB}$ 谁在控制？
4. 非线性电容电流最终由外部源、主输出还是辅助支路承担？
5. 低频与高频是否在不同反馈机制下工作？
6. 哪个内部节点限制 settling 尾部？
7. 标出的带宽与最终高 SFDR 频带有什么关系？
8. 补偿收益是宽带改善还是偶然相消？
9. 测试包含哪些现实非理想，缺了什么？
10. 对照论文的数字是 buffer 结果还是整个 ADC 的结果，实测还是仿真？

## 22. 经典论文与阅读顺序

### 22.1 基础原理文献

以下三篇用于建立模型与术语；它们不在本次 `Input Buffer` 分类的 45 条主条目中，属于补充书目。正文对本地应用论文的分析不依赖把补充书目假装成已完整精读。

1. **R. G. Carvajal et al.**, “The Flipped Voltage Follower: A Useful Cell for Low-Voltage Low-Power Circuit Design,” *IEEE Transactions on Circuits and Systems I: Regular Papers*, 52(7), 1276–1291, 2005. [DOI](https://doi.org/10.1109/TCSI.2005.851387)。重点：FVF 的基本单元、变体、摆幅及反馈机制。书目信息亦见本地 `IZ8STV8W` 参考文献 [11]。
2. **X. Fan and P. K. Chan**, “Analysis and Design of Low-Distortion CMOS Source Followers,” *IEEE Transactions on Circuits and Systems I: Regular Papers*, 52(8), 1489–1501, 2005. [DOI](https://doi.org/10.1109/TCSI.2005.851711)；[作者机构原文入口](https://dr.ntu.edu.sg/bitstream/10356/91313/1/Analysis%20and%20Design%20of%20Low-Distortion%20CMOS%20Source%20Followers.pdf)。重点：SF 失真机制的系统分析，不把有限 $r_o$ 与负载电流效应混为一谈。
3. **A. J. Lopez-Martin, L. Acosta, C. Garcia-Alberdi, R. G. Carvajal, and J. Ramirez-Angulo**, “Power-Efficient Analog Design Based on the Class AB Super Source Follower,” *International Journal of Circuit Theory and Applications*, 40(11), 1143–1163, 2012（2011 在线发表）. [DOI](https://doi.org/10.1002/cta.776)；[出版商卷期目录](https://doi.org/10.1002/cta.v40.11)。重点：Class-AB SSF 的电流效率与动态驱动。书目与本地 `MQDUICAW` 的参考文献链一致。

另可阅读 **A. M. Abo and P. R. Gray**, “A 1.5-V, 10-bit, 14.3-MS/s CMOS Pipeline Analog-to-Digital Converter,” *IEEE JSSC*, 34(5), 599–606, 1999. [DOI](https://doi.org/10.1109/4.760369)。它主要是低电压采样开关 bootstrap 与可靠性背景，不是 GHz PPSF 的直接性能基准。

### 22.2 建议精读路线

| 顺序 | 本地论文 | 阅读任务 |
|---|---|---|
| 1 | `88KUWJYB`，Ali 2014 | 从 SF 的负载电流调制出发，理解复制电容与 drain bootstrap 为什么要同时存在 |
| 2 | `B5HLXYYN`，Huang 2022 | 对照 Fig. 2 的 FFC/FVF/AC-FVF，手写每个管的饱和不等式 |
| 3 | `MQDUICAW`，Shifman 2019 | 画 SSF 动态电流路径，解释内部 DC 调节、PSRR 和 hold-node ISI |
| 4 | `JI8G84VA`，Devarajan 2017 | 精读 §III-B 与 Figs. 10–12，逐级分析 PPSF、body 及快速开关 |
| 5 | `PKP4WR5K`，Scaletti 2023 | 理解为何 body 接 source 仍不够，以及辅助 buffer 应驱动什么 |
| 6 | `IZ8STV8W`，Li 2024 | 把两级 CCSF 的电平、噪声和反馈路径统一起来 |
| 7 | `AMZFXGAJ`，Cao 2024 | 精读 §IV 的 SACC；区分 buffer 模拟线性化与 TI 数字校准 |
| 8 | `3ILPCVZH`，Ali 2020 | 研究 THA 输入／输出 buffer 的不同任务与 memory 校准 |
| 9 | `GHM37WIL`，Markulić 2024 | 按开关顺序追踪采样、预开启、转移及关断，画电荷状态表 |
| 10 | `62CPDB27`，Heel 2025 | 联合分析 S 参数、输入电容、双 PPSF 路径及高 Nyquist 区 tracking |
| 11 | `RNRP3VQM`、`DLDWSRMX` | 学习辅助 bootstrap／双环设计及后仿报告，同时审查假设和比较口径 |
| 12 | `E4HP4VRY`，Li 2026 | 从采样电容两端电压出发理解 replica-to-CM 系统补偿 |

### 22.3 每篇论文的阅读记录模板

> **书目**：作者、标题、年份、DOI、Zotero key。  
> **目标与位置**：pad 前端／公共 buffer／嵌套 buffer／reference／RA。  
> **结构**：主跟随管、负载电流路径、反馈节点、bias、共模与时序。  
> **机制**：主要抑制 $\Delta I_D$、$\Delta V_{DS}$、$\Delta V_{SB}$、非线性电容还是 memory。  
> **条件**：工艺、供电、$f_s$、$f_{in}$、摆幅、源阻抗、有效负载与采样方式。  
> **证据**：实测／原理图／后仿；有无消融比较；是否包含校准。  
> **代价**：输入电容、面积、功耗、低频覆盖、稳定性和可靠性。  
> **可迁移结论**：哪些依赖机制，哪些只适用于原文参数。  
> **待核验点**：缺少的条件、图文不一致、未来需要复现的实验。

## 附录 A：符号与速查公式

| 符号 | 定义／单位 |
|---|---|
| $f_s, f_{in}$ | 采样率、模拟输入频率，Hz |
| $V_{pp,diff},V_{p,se}$ | 差分峰峰值、每侧单端峰值，V |
| $C_s,C_L,C_H$ | 采样、有效负载、保持电容，F；必须说明每侧或差分 |
| $g_m,g_{mb},g_{ds}$ | 栅跨导、体跨导、漏源输出电导，S |
| $r_o,R_{out},Z_{out}$ | 单管输出电阻、buffer 低频输出电阻、频率相关输出阻抗，Ω |
| $V_{TH},U_T$ | 阈值电压、热电压 $kT/q$，V；两者不同 |
| $V_{DSAT},M$ | 模型饱和边界电压、饱和裕量，V |
| $T(s),\alpha$ | 局部环路增益、耦合比例，无量纲 |
| $\tau,SR,\sigma_t$ | 时间常数 s、压摆率 V/s、时间抖动 RMS s |

| 目的 | 速查关系 | 前提 |
|---|---|---|
| 每侧正弦电流 | $I_{pk}=2\pi f_{in}C_LV_{pp,diff}/4$ | 对称差分、每侧对地线性电容 |
| 电荷转移 | $\Delta Q=C_s\Delta V$ | 明确两次状态的电容电压 |
| 一阶建立 | $t>\tau\ln(\Delta V/\epsilon)$ | 无 slew／多极点，目标固定 |
| SF 输出阻抗 | $R_{out}\sim1/g_m$ | 忽略 body、输出电导及有限输入阻抗 |
| PPSF 输出阻抗 | $R_{out}\sim1/(g_{mN}+g_{mP})$ | 两支路工作、驱动路径近理想 |
| FVF／SSF 输出阻抗 | $R_{out}\sim1/(g_{m1}r_xg_{m,aux})$ | 足够局部增益、有效反馈频段 |
| 采样热噪声 | $\sigma^2\sim kT/C_s$ | 简单热平衡采样网络 |
| 抖动上限 | $SNR_j\approx-20\log_{10}(2\pi f_{in}\sigma_t)$ | 正弦、小且独立的随机时间误差 |
| Drain 跟随残差 | $\Delta v_{DS}=(H_d-H_s)v_{in}$ | 同一参考下的两路径传输 |

## 附录 B：Zotero 分类完整索引

以下保留本次读取的 45 条主文献。标题和书目信息以当前 Zotero 条目为检索入口；条目自带的明显格式问题不作为技术结论。每条均有可读取的本地 PDF。表中“核心”指本笔记重点核读了相关正文／图表；“延伸”指以元数据、摘要及局部检索为主，不据此承诺全文精读。

| # | 年份 | 标题／DOI | Zotero key | 阅读层级与用途 |
|---|---|---|---|---|
| 1 | 2019 | [A 1.64mW Differential Super Source-Follower Buffer with 9.7GHz BW and 43dB PSRR for Time-Interleaved ADC Applications in 10nm](https://doi.org/10.1109/A-SSCC47793.2019.9056969) | MQDUICAW | 核心：差分 Class-AB SSF；TH 间缓冲、PSRR 与 ISI；两份附件 |
| 2 | 2022 | [A 12b 8GS/s Time-Interleaved 2b/cycle Pipelined-SAR ADC with Layout-Customized Bootstrap and Super- Source-Follower Based Open-Loop Residue Amplifier](https://doi.org/10.1109/A-SSCC56115.2022.9980717) | N7S2F5SW | 延伸：layout-customized bootstrap；标题 SSF 为残差放大器；两份附件 |
| 3 | 2022 | [A 6-GHz bandwidth input buffer based on AC-coupled flipped source follower for 12-bit 8-GS/s ADC in 28-nm CMOS](https://doi.org/10.1109/TCSII.2022.3188534) | B5HLXYYN | 核心：AC 耦合 FVF；DC 压头解耦、非线性电容补偿；ADC 实测 |
| 4 | 2025 | [A 12.8GS/s Sub-Sampling ADC Front-End With 38GHz Input Bandwidth and >39dB SNDR for 1 to 32GHz in 22nm FDSOI](https://doi.org/10.1109/ISSCC49661.2025.10904786) | H5EAYBPS | 延伸：38-GHz 欠采样前端；优先连同期刊版 62CPDB27 阅读 |
| 5 | 2024 | [A 12-GS/s 12-b 4× Time-Interleaved ADC Using Input-Independent Timing Skew Calibration With Global Dither Injection and Linearized Input Buffer](https://doi.org/10.1109/JSSC.2024.3482567) | AMZFXGAJ | 核心：SACC 线性化 PPSF 与 global dither；分清 THD 仿真和 ADC 实测 |
| 6 | 2023 | [An 8-GHz Bandwidth Push-Pull Input Buffer Based on Cascode Source Follower](https://doi.org/10.1109/ICCS59502.2023.10367338) | LNC88I8F | 核心：cascode/drain-bootstrap PPSF；原文仿真案例 |
| 7 | 2024 | [A 10GS/s hierarchical time-interleaved ADC for RF-sampling applications](https://doi.org/10.1109/VLSITechnologyandCir46783.2024.10631521) | GHM37WIL | 核心：分层采样、动态 PP-SF、预开启与分布电容 |
| 8 | 2022 | [A 12-bit 10GS/s 16-channel time-interleaved ADC with a digital processing timing-skew background calibration in 5nm FinFET](https://doi.org/10.1109/VLSITechnologyandCir46769.2022.9830208) | 22EC9XFJ | 延伸：级联 input buffers 与 16 路交织；系统级负载问题 |
| 9 | 2010 | [A 16-bit 250-MS/s IF sampling pipelined ADC with background calibration](https://doi.org/10.1109/JSSC.2010.2073194) | 4YWX7JWG | 延伸：BiCMOS IF ADC；复制交流电流线性化的早期代表，非纯 CMOS 同条件基准 |
| 10 | 2020 | [A 12-b 18-GS/s RF sampling ADC with an integrated wideband track-and-hold amplifier and background calibration](https://doi.org/10.1109/JSSC.2020.3023882) | 3ILPCVZH | 核心：集成 THA，input/output PPSF、memory 与非线性校准 |
| 11 | 2017 | [A 12-b 10-GS/s interleaved pipeline ADC in 28-nm CMOS technology](https://doi.org/10.1109/JSSC.2017.2747758) | JI8G84VA | 核心：公共 PPSF、多层 drain/body bootstrap、快速开启采样开关 |
| 12 | 2016 | [A 14-bit 2.5GS/s and 5GS/s RF sampling ADC with background calibration and dither](https://doi.org/10.1109/VLSIC.2016.7573537) | 6FUJA82V | 延伸：高采样率 pipeline、dither 与 kickback/memory 校准 |
| 13 | 2020 | [16.1 a 12b 18GS/s RF sampling ADC with an integrated wideband track-and-hold amplifier and background calibration](https://doi.org/10.1109/ISSCC19947.2020.9063011) | ZVCUCLPN | 延伸：18-GS/s THA ADC 会议版；关联 3ILPCVZH |
| 14 | 2024 | [An energy-efficient pipeline-SAR ADC using linearized dynamic amplifiers and input buffer in 22nm FDSOI](https://doi.org/10.1109/OJCAS.2024.3509746) | W4W9MXFF | 延伸：线性化动态放大器兼作 input buffer；不归入裸 SF 性能比较 |
| 15 | 2024 | [An 82dB-SNDR input-driving-relaxed noise-shaping SAR with amplifier-reused in-loop buffering and NTF leakage reshaping](https://doi.org/10.1109/CICC60959.2024.10528963) | VQRUXTRN | 延伸：NS-SAR 环内缓冲与放大器复用；低频精密架构协同 |
| 16 | 2019 | [A 4MS/s 10b SAR ADC with integrated class-a buffers in 65nm CMOS with near rail-to-rail input using a single 1.2V supply](https://doi.org/10.1109/CICC.2019.8780150) | TUNAAEPC | 延伸：输入交换使每个 Class-A buffer 处理半幅；近轨到轨、低速场景 |
| 17 | 2024 | [22.5 a 42GS/s 7b 16nm massively time-interleaved slope-ADC](https://doi.org/10.1109/ISSCC49657.2024.10454361) | R6EJFA72 | 延伸：大量交织 slope ADC；面积和层级信号分发 |
| 18 | 2023 | [A novel push-pull input buffer for wideband ADCs with improved high-frequency linearity](https://doi.org/10.1109/NEWCAS57931.2023.10198057) | PKP4WR5K | 核心：辅助 body buffer 移走非线性阱电容负载；原理图 QPSS |
| 19 | 2023 | [A 750mW 24GS/s 12b time-interleaved ADC for direct RF sampling in modern wireless systems](https://doi.org/10.1109/ISSCC42615.2023.10067793) | PC7XJPCI | 延伸：24-GS/s RF ADC 系统；输入 BW、噪声密度与功耗口径 |
| 20 | 2023 | [10.4 a rail-to-rail 12MS 91.3dB SNDR 94.1dB DR two-step SAR ADC with integrated input buffer using predictive level-shifting](https://doi.org/10.1109/ISSCC42615.2023.10067703) | JGRSKTLS | 延伸：predictive level-shifting；精密轨到轨集成驱动 |
| 21 | 2023 | [A 12b 1GS/s ADC with lightweight input buffer distortion background calibration achieving >75dB SFDR over PVT](https://doi.org/10.1109/CICC57935.2023.10121262) | JFA45H8T | 延伸：input buffer 失真后台校准；原始元数据摘要不等号需回原图核对 |
| 22 | 2024 | [A wideband input buffer based on cascade complementary source follower](https://doi.org/10.1109/TVLSI.2024.3349564) | IZ8STV8W | 核心：两级 CCSF、补偿与辅助运放；后仿 |
| 23 | 2018 | [An operational amplifier assisted input buffer and an improved bootstrapped switch for high-speed and high-resolution ADCs](https://doi.org/10.1109/ISCAS.2018.8351071) | INH286V4 | 延伸：运放辅助 buffer 与改进采样 bootstrap；仿真机制 |
| 24 | 2025 | [A low-voltage input buffer with linearity-enhancement scheme for a 500MS/s Pipelined-SAR ADC achieving SFDR> 79dBc](https://doi.org/10.1016/j.mejo.2025.106918) | HSZ932F6 | 延伸：低压自适应 bias 与前台校准；不能仅凭题目判定测量边界 |
| 25 | 2021 | [An input-buffer embedding dual-residue pipelined-SAR ADC with nonbinary capacitive interpolation](https://doi.org/10.1109/A-SSCC53895.2021.9634731) | HCG8BF8F | 延伸：buffer 嵌入 dual-residue pipeline-SAR；系统拓扑关联 |
| 26 | 2020 | [Low-voltage high-linearity differential input buffer with CurrentAmplifier feed-forward compensation for high-speed ADCs](https://doi.org/10.1109/ICTA50426.2020.9332138) | G6KZINTI | 延伸：辅助 SF／电流放大器前馈补偿；两音仿真 |
| 27 | 2024 | [22.1 a 12GS/s 12b 4× time-interleaved pipelined ADC with comprehensive calibration of TI errors and linearized input buffer](https://doi.org/10.1109/ISSCC49657.2024.10454350) | FBZ8DVAA | 延伸：SACC + global dither 会议版；关联 AMZFXGAJ |
| 28 | 2022 | [A wideband high-linearity input buffer based on cascade complementary source follower](https://doi.org/10.1109/ICTA56932.2022.9962966) | ANGSAUNX | 延伸：CCSF 会议方案；关联 IZ8STV8W，参数可能有演进 |
| 29 | 2018 | [A 39mW 7b 8GS/s 8-way TI ADC with cross-linearized input and bootstrapped sampling buffer front-end](https://doi.org/10.1109/ESSCIRC.2018.8494309) | 9DLIAPPX | 延伸：cross-linearized level shifter 和有源采样 bootstrap |
| 30 | 2025 | [An easy-drive 16MS/s pipelined-SAR ADC using split coarse-fine input-buffer-sampling scheme and fast robust background inter-stage gain calibration](https://doi.org/10.1109/ISSCC49661.2025.10904526) | 8KQ4S4U4 | 延伸：split coarse-fine 缓冲采样；中速高精度 easy-drive |
| 31 | 2014 | [A 14 bit 1 GS/s RF sampling pipelined ADC with background calibration](https://doi.org/10.1109/JSSC.2014.2361339) | 88KUWJYB | 核心：SF 复制电容前馈 + drain bootstrap；输入电流路径 |
| 32 | 2023 | [17.1 a 2x-lnterleaved 9b 2.8G8S/s 5b/cycle SAR ADC with linearized configurable V2T buffer achieving >50dB SNDR at 3GHz input](https://doi.org/10.1109/ISSCC42615.2023.10067627) | 6YR4CMCH | 延伸：可配置 V2T buffer；先区分电压缓冲与电压时间转换 |
| 33 | 2025 | [A 12.8-GS/s time-interleaved sub-sampling ADC front end with 38-GHz input bandwidth and >39-dB SNDR for 1–32 GHz in 22-nm FDSOI](https://doi.org/10.1109/JSSC.2025.3598874) | 62CPDB27 | 核心：匹配网络、PPSF 与有源 bootstrap；多十 GHz 欠采样实测 |
| 34 | 2023 | [A 1.2-mA fast-charge input buffer with CLS for 4-MS/s SC oversampling ADC achieving +1-2.5-ppm/FSR INL](https://doi.org/10.1109/ICTA60488.2023.10364291) | 4FVUXHNU | 延伸：fast-charge + CLS；低速高精度 SC 负载参考 |
| 35 | 2025 | [A multi-step ADC with lightweight input buffer distortion, sub-stage coarse-fine gain, and sampling skew background calibrations](https://doi.org/10.1109/TCSI.2025.3571064) | 3X7GXCLC | 延伸：多级 ADC 综合校准；失真、粗细增益与采样偏斜 |
| 36 | 2025 | [18.5 a rail-to-rail 3rd-order noise-shaping SAR ADC achieving 105.4dB SFDR with integrated input buffer using continuous-time correlated level shifting](https://doi.org/10.1109/ISSCC49661.2025.10904773) | 3AMKCD9G | 延伸：连续时间 CLS 集成 buffer；精密 NS-SAR |
| 37 | 2024 | [A wideband front-end with integrated high-voltage assisted input buffer for high-speed ADC](https://doi.org/10.1587/elex.21.20240640) | HX7AH9JH | 延伸：片上高压辅助、输入匹配与电感补偿 |
| 38 | 2022 | [An Input Buffer with 85dB SFDR for High-Speed Pipeline ADC](https://doi.org/10.1109/ICTA56932.2022.9962993) | 24NJ98YZ | 延伸：输出驱动的两级 bootstrap；减小源／封装所承受非线性电流 |
| 39 | 2024 | [A 1.25-GS/s 14-bit pipelined ADC using a current-feedback flipped input buffer and large dither technique to achieve high linearity](https://doi.org/10.1587/elex.21.20240457) | FECPS4YU | 延伸：current-feedback flipped buffer 与 large dither 协同 |
| 40 | 2025 | [An input buffer with opamp-based bootstrap circuit and cross-coupled substrate technique for 1.5-GS/s pipelined ADC in 40-nm CMOS process](https://doi.org/10.1587/elex.22.20250092) | RNRP3VQM | 核心：运放 bootstrap、交叉 body；后仿、PVT 和 MC 图 |
| 41 | 2025 | [A 24-GHz Bandwidth 58.8-dB SNDR Input Buffer Based on Class-AB Enhanced Super Source Follower](https://doi.org/10.1109/ICTA68203.2025.11329604) | DLDWSRMX | 核心：Class-AB ESSF 与 AC-FVF 双环；24-GHz 后仿案例 |
| 42 | 2025 | [An Input Buffer with Replica-Based Nonlinearity Compensation for High-Speed ADCs](https://doi.org/10.1109/ICTA68203.2025.11329780) | 4VVZMRMD | 延伸：replica 非线性电流到采样 CM；关联 E4HP4VRY |
| 43 | 2026 | [A 14-bit 3 GS/s pipelined ADC featuring an input buffer with replica-based nonlinearity compensation in 28-nm CMOS technology](https://doi.org/10.1016/j.mejo.2025.107015) | E4HP4VRY | 核心：replica-to-CM 补偿；最终电容差分值线性化，ADC 实测 |
| 44 | 2026 | [11.5 A Compact 7b 175GS/s Linearized Time-Interleaved Slope ADC with Switched Input Buffers](https://doi.org/10.1109/ISSCC49663.2026.11409101) | 77HKX23V | 延伸：switched input buffers 与 2048 路层级 slope ADC |
| 45 | 2026 | [A high-linearity input buffer and early-trigger scheme for GS/s pipelined ADCs](https://doi.org/10.1016/j.mejo.2026.107233) | QRCJT5DZ | 延伸：ping-pong bootstrap、varactor、early-trigger；摘要明确为仿真 |

### B.1 完整书目（本地元数据）

- **[MQDUICAW]** Yizhak Shifman, Yoel Krupnik, Udi Virobnik et al.. “A 1.64mW Differential Super Source-Follower Buffer with 9.7GHz BW and 43dB PSRR for Time-Interleaved ADC Applications in 10nm.” 2019 IEEE Asian Solid-State Circuits Conference (A-SSCC); vol. 2019; pp. 235-238, 2019. [DOI: 10.1109/A-SSCC47793.2019.9056969](https://doi.org/10.1109/A-SSCC47793.2019.9056969).

- **[N7S2F5SW]** Qiang Yu, Jie Pu, Jian Luo et al.. “A 12b 8GS/s Time-Interleaved 2b/cycle Pipelined-SAR ADC with Layout-Customized Bootstrap and Super- Source-Follower Based Open-Loop Residue Amplifier.” 2022 IEEE Asian Solid-State Circuits Conference (A-SSCC); pp. 1-3, 2022. [DOI: 10.1109/A-SSCC56115.2022.9980717](https://doi.org/10.1109/A-SSCC56115.2022.9980717).

- **[B5HLXYYN]** Zhengbo Huang, Jie Zhang, Yuanjun Cen et al.. “A 6-GHz bandwidth input buffer based on AC-coupled flipped source follower for 12-bit 8-GS/s ADC in 28-nm CMOS.” IEEE Transactions on Circuits and Systems II: Express Briefs; vol. 69; no. 10; pp. 4163-4167, 2022. [DOI: 10.1109/TCSII.2022.3188534](https://doi.org/10.1109/TCSII.2022.3188534).

- **[H5EAYBPS]** Josef Heel, Harijot Singh Bindra, Simon Louwsma et al.. “A 12.8GS/s Sub-Sampling ADC Front-End With 38GHz Input Bandwidth and >39dB SNDR for 1 to 32GHz in 22nm FDSOI.” 2025 IEEE International Solid-State Circuits Conference (ISSCC); pp. 76-78, 2025. [DOI: 10.1109/ISSCC49661.2025.10904786](https://doi.org/10.1109/ISSCC49661.2025.10904786).

- **[AMZFXGAJ]** Yuefeng Cao, Minglei Zhang, Yan Zhu et al.. “A 12-GS/s 12-b 4× Time-Interleaved ADC Using Input-Independent Timing Skew Calibration With Global Dither Injection and Linearized Input Buffer.” IEEE Journal of Solid-State Circuits; vol. 59; no. 12; pp. 4211-4224, 2024. [DOI: 10.1109/JSSC.2024.3482567](https://doi.org/10.1109/JSSC.2024.3482567).

- **[LNC88I8F]** Jian Nan, Chenghao Zhang, Yihang Yang et al.. “An 8-GHz Bandwidth Push-Pull Input Buffer Based on Cascode Source Follower.” 2023 5th International Conference on Circuits and Systems (ICCS); pp. 70-74, 2023. [DOI: 10.1109/ICCS59502.2023.10367338](https://doi.org/10.1109/ICCS59502.2023.10367338).

- **[GHM37WIL]** Nereo Markulić, Johan Nguyen, Jorge Lagos Benites et al.. “A 10GS/s hierarchical time-interleaved ADC for RF-sampling applications.” 2024 IEEE Symposium on VLSI Technology and Circuits (VLSI Technology and Circuits); pp. 1-2, 2024. [DOI: 10.1109/VLSITechnologyandCir46783.2024.10631521](https://doi.org/10.1109/VLSITechnologyandCir46783.2024.10631521).

- **[22EC9XFJ]** Kyoung-Jun Moon, Dong-Ryeol Oh, Young-Hyo Park et al.. “A 12-bit 10GS/s 16-channel time-interleaved ADC with a digital processing timing-skew background calibration in 5nm FinFET.” 2022 IEEE Symposium on VLSI Technology and Circuits (VLSI Technology and Circuits); pp. 172-173, 2022. [DOI: 10.1109/VLSITechnologyandCir46769.2022.9830208](https://doi.org/10.1109/VLSITechnologyandCir46769.2022.9830208).

- **[4YWX7JWG]** A M A Ali, A Morgan, C Dillon et al.. “A 16-bit 250-MS/s IF sampling pipelined ADC with background calibration.” IEEE Journal of Solid-State Circuits; vol. 45; no. 12; pp. 2602-2612, 2010. [DOI: 10.1109/JSSC.2010.2073194](https://doi.org/10.1109/JSSC.2010.2073194).

- **[3ILPCVZH]** Ahmed M. A. Ali, Huseyin Dinc, Paritosh Bhoraskar et al.. “A 12-b 18-GS/s RF sampling ADC with an integrated wideband track-and-hold amplifier and background calibration.” IEEE Journal of Solid-State Circuits; vol. 55; no. 12; pp. 3210-3224, 2020. [DOI: 10.1109/JSSC.2020.3023882](https://doi.org/10.1109/JSSC.2020.3023882).

- **[JI8G84VA]** Siddharth Devarajan, Larry Singer, Dan Kelly et al.. “A 12-b 10-GS/s interleaved pipeline ADC in 28-nm CMOS technology.” IEEE Journal of Solid-State Circuits; vol. 52; no. 12; pp. 3204-3218, 2017. [DOI: 10.1109/JSSC.2017.2747758](https://doi.org/10.1109/JSSC.2017.2747758).

- **[6FUJA82V]** Ahmed M.A. Ali, Huseyin Dinc, Paritosh Bhoraskar et al.. “A 14-bit 2.5GS/s and 5GS/s RF sampling ADC with background calibration and dither.” 2016 IEEE Symposium on VLSI Circuits (VLSI-Circuits); pp. 1-2, 2016. [DOI: 10.1109/VLSIC.2016.7573537](https://doi.org/10.1109/VLSIC.2016.7573537).

- **[ZVCUCLPN]** Ahmed M. A. Ali, Huseyin Dinc, Paritosh Bhoraskar et al.. “16.1 a 12b 18GS/s RF sampling ADC with an integrated wideband track-and-hold amplifier and background calibration.” 2020 IEEE International Solid-state Circuits Conference - (ISSCC); pp. 250-252, 2020. [DOI: 10.1109/ISSCC19947.2020.9063011](https://doi.org/10.1109/ISSCC19947.2020.9063011).

- **[W4W9MXFF]** Bangda Yang, Trevor Caldwell, Anthony Chan Carusone. “An energy-efficient pipeline-SAR ADC using linearized dynamic amplifiers and input buffer in 22nm FDSOI.” IEEE Open Journal of Circuits and Systems; vol. 6; pp. 50-62, 2024. [DOI: 10.1109/OJCAS.2024.3509746](https://doi.org/10.1109/OJCAS.2024.3509746).

- **[VQRUXTRN]** Tian Xie, Ken Li, Tzu-Han Wang et al.. “An 82dB-SNDR input-driving-relaxed noise-shaping SAR with amplifier-reused in-loop buffering and NTF leakage reshaping.” 2024 IEEE Custom Integrated Circuits Conference (CICC); pp. 1-2, 2024. [DOI: 10.1109/CICC60959.2024.10528963](https://doi.org/10.1109/CICC60959.2024.10528963).

- **[TUNAAEPC]** Harijot Singh Bindra, Anne-Johan Annema, Gerard Wienk et al.. “A 4MS/s 10b SAR ADC with integrated class-a buffers in 65nm CMOS with near rail-to-rail input using a single 1.2V supply.” 2019 IEEE Custom Integrated Circuits Conference (CICC); pp. 1-4, 2019. [DOI: 10.1109/CICC.2019.8780150](https://doi.org/10.1109/CICC.2019.8780150).

- **[R6EJFA72]** Ewout Martens, Adam Cooman, Pratap Renukaswamy et al.. “22.5 a 42GS/s 7b 16nm massively time-interleaved slope-ADC.” 2024 IEEE International Solid-state Circuits Conference (ISSCC); vol. 67; pp. 396-398, 2024. [DOI: 10.1109/ISSCC49657.2024.10454361](https://doi.org/10.1109/ISSCC49657.2024.10454361).

- **[PKP4WR5K]** Lorenzo Scaletti, Luca Bertulessi, Andrea Cristofoli et al.. “A novel push-pull input buffer for wideband ADCs with improved high-frequency linearity.” 2023 21st IEEE Interregional NEWCAS Conference (NEWCAS); pp. 1-5, 2023. [DOI: 10.1109/NEWCAS57931.2023.10198057](https://doi.org/10.1109/NEWCAS57931.2023.10198057).

- **[PC7XJPCI]** Sandeep Santhosh Kumar, Masahiro Kudo, Vlad Cretu et al.. “A 750mW 24GS/s 12b time-interleaved ADC for direct RF sampling in modern wireless systems.” 2023 IEEE International Solid-state Circuits Conference (ISSCC); pp. 1-3, 2023. [DOI: 10.1109/ISSCC42615.2023.10067793](https://doi.org/10.1109/ISSCC42615.2023.10067793).

- **[JGRSKTLS]** Manxin Li, Calvin Yoji Lee, Ahmed ElShater et al.. “10.4 a rail-to-rail 12MS 91.3dB SNDR 94.1dB DR two-step SAR ADC with integrated input buffer using predictive level-shifting.” 2023 IEEE International Solid-state Circuits Conference (ISSCC); pp. 1-3, 2023. [DOI: 10.1109/ISSCC42615.2023.10067703](https://doi.org/10.1109/ISSCC42615.2023.10067703).

- **[JFA45H8T]** Xianghui Pan, Buhui Rui, Yuefeng Cao et al.. “A 12b 1GS/s ADC with lightweight input buffer distortion background calibration achieving >75dB SFDR over PVT.” 2023 IEEE Custom Integrated Circuits Conference (CICC); pp. 1-2, 2023. [DOI: 10.1109/CICC57935.2023.10121262](https://doi.org/10.1109/CICC57935.2023.10121262).

- **[IZ8STV8W]** Dengquan Li, Tian Feng, Jiale Ding et al.. “A wideband input buffer based on cascade complementary source follower.” IEEE Transactions on Very Large Scale Integration (VLSI) Systems; vol. 32; no. 5; pp. 962-966, 2024. [DOI: 10.1109/TVLSI.2024.3349564](https://doi.org/10.1109/TVLSI.2024.3349564).

- **[INH286V4]** Yuefeng Cao, Tianli Zhang, Yongzhen Chen et al.. “An operational amplifier assisted input buffer and an improved bootstrapped switch for high-speed and high-resolution ADCs.” 2018 IEEE International Symposium on Circuits and Systems (ISCAS); pp. 1-5, 2018. [DOI: 10.1109/ISCAS.2018.8351071](https://doi.org/10.1109/ISCAS.2018.8351071).

- **[HSZ932F6]** Fangyuan Xu, Yina Shangguan, Xuan Guo et al.. “A low-voltage input buffer with linearity-enhancement scheme for a 500MS/s Pipelined-SAR ADC achieving SFDR> 79dBc.” Microelectronics Journal; vol. 167; pp. 106918, 2025. [DOI: 10.1016/j.mejo.2025.106918](https://doi.org/10.1016/j.mejo.2025.106918).

- **[HCG8BF8F]** Seung-Yong Lim, Raymond Mabilangan, Dong-Jin Chang et al.. “An input-buffer embedding dual-residue pipelined-SAR ADC with nonbinary capacitive interpolation.” 2021 IEEE Asian Solid-state Circuits Conference (A-SSCC); pp. 1-3, 2021. [DOI: 10.1109/A-SSCC53895.2021.9634731](https://doi.org/10.1109/A-SSCC53895.2021.9634731).

- **[G6KZINTI]** Zhengbo Huang, Hong Zhang, Ting Li et al.. “Low-voltage high-linearity differential input buffer with CurrentAmplifier feed-forward compensation for high-speed ADCs.” 2020 IEEE International Conference on Integrated Circuits, Technologies and Applications (ICTA); pp. 41-42, 2020. [DOI: 10.1109/ICTA50426.2020.9332138](https://doi.org/10.1109/ICTA50426.2020.9332138).

- **[FBZ8DVAA]** Yuefeng Cao, Minglei Zhang, Yan Zhu et al.. “22.1 a 12GS/s 12b 4× time-interleaved pipelined ADC with comprehensive calibration of TI errors and linearized input buffer.” 2024 IEEE International Solid-state Circuits Conference (ISSCC); vol. 67; pp. 388-390, 2024. [DOI: 10.1109/ISSCC49657.2024.10454350](https://doi.org/10.1109/ISSCC49657.2024.10454350).

- **[ANGSAUNX]** Tian Feng, Dengquan Li, Jiale Ding et al.. “A wideband high-linearity input buffer based on cascade complementary source follower.” 2022 IEEE International Conference on Integrated Circuits, Technologies and Applications (ICTA); pp. 13-14, 2022. [DOI: 10.1109/ICTA56932.2022.9962966](https://doi.org/10.1109/ICTA56932.2022.9962966).

- **[9DLIAPPX]** Chi-Hang Chan, Yan Zhu, Zihao Zheng et al.. “A 39mW 7b 8GS/s 8-way TI ADC with cross-linearized input and bootstrapped sampling buffer front-end.” ESSCIRC 2018 - IEEE 44th European Solid State Circuits Conference (ESSCIRC); pp. 254-257, 2018. [DOI: 10.1109/ESSCIRC.2018.8494309](https://doi.org/10.1109/ESSCIRC.2018.8494309).

- **[8KQ4S4U4]** Zhuoyi Chen, Siyuan Ye, Jihang Gao et al.. “An easy-drive 16MS/s pipelined-SAR ADC using split coarse-fine input-buffer-sampling scheme and fast robust background inter-stage gain calibration.” 2025 IEEE International Solid-state Circuits Conference (isscc); vol. 68; pp. 1-3, 2025. [DOI: 10.1109/ISSCC49661.2025.10904526](https://doi.org/10.1109/ISSCC49661.2025.10904526).

- **[88KUWJYB]** Ahmed M. A. Ali, Huseyin Dinc, Paritosh Bhoraskar et al.. “A 14 bit 1 GS/s RF sampling pipelined ADC with background calibration.” IEEE Journal of Solid-State Circuits; vol. 49; no. 12; pp. 2857-2867, 2014. [DOI: 10.1109/JSSC.2014.2361339](https://doi.org/10.1109/JSSC.2014.2361339).

- **[6YR4CMCH]** Hongzhi Zhao, Minglei Zhang, Yan Zhu et al.. “17.1 a 2x-lnterleaved 9b 2.8G8S/s 5b/cycle SAR ADC with linearized configurable V2T buffer achieving >50dB SNDR at 3GHz input.” 2023 IEEE International Solid-state Circuits Conference (ISSCC); pp. 1-3, 2023. [DOI: 10.1109/ISSCC42615.2023.10067627](https://doi.org/10.1109/ISSCC42615.2023.10067627).

- **[62CPDB27]** Josef Heel, Harijot Singh Bindra, Simon M. Louwsma et al.. “A 12.8-GS/s time-interleaved sub-sampling ADC front end with 38-GHz input bandwidth and >39-dB SNDR for 1–32 GHz in 22-nm FDSOI.” IEEE Journal of Solid-State Circuits; vol. 60; no. 12; pp. 4321-4335, 2025. [DOI: 10.1109/JSSC.2025.3598874](https://doi.org/10.1109/JSSC.2025.3598874).

- **[4FVUXHNU]** Yang Chen, Binyu Cai, Changhuan Chen et al.. “A 1.2-mA fast-charge input buffer with CLS for 4-MS/s SC oversampling ADC achieving +1-2.5-ppm/FSR INL.” 2023 IEEE International Conference on Integrated Circuits, Technologies and Applications (ICTA); pp. 105-107, 2023. [DOI: 10.1109/ICTA60488.2023.10364291](https://doi.org/10.1109/ICTA60488.2023.10364291).

- **[3X7GXCLC]** Xianghui Pan, Buhui Rui, Yuefeng Cao et al.. “A multi-step ADC with lightweight input buffer distortion, sub-stage coarse-fine gain, and sampling skew background calibrations.” IEEE Transactions on Circuits and Systems I: Regular Papers; vol. 72; no. 11; pp. 6567-6577, 2025. [DOI: 10.1109/TCSI.2025.3571064](https://doi.org/10.1109/TCSI.2025.3571064).

- **[3AMKCD9G]** Siyuan Ye, Jiajia Cui, Jihang Gao et al.. “18.5 a rail-to-rail 3rd-order noise-shaping SAR ADC achieving 105.4dB SFDR with integrated input buffer using continuous-time correlated level shifting.” 2025 IEEE international solid-state circuits conference; vol. 68; pp. 314-316, 2025. [DOI: 10.1109/ISSCC49661.2025.10904773](https://doi.org/10.1109/ISSCC49661.2025.10904773).

- **[HX7AH9JH]** Zilin Jiang, Danyu Wu, Xuan Guo et al.. “A wideband front-end with integrated high-voltage assisted input buffer for high-speed ADC.” IEICE Electronics Express; vol. 21; no. 24; pp. 20240640-20240640, 2024. [DOI: 10.1587/elex.21.20240640](https://doi.org/10.1587/elex.21.20240640).

- **[24NJ98YZ]** Cece Huang, Yuanfu Zhao, Yafei Ji et al.. “An Input Buffer with 85dB SFDR for High-Speed Pipeline ADC.” 2022 IEEE International Conference on Integrated Circuits, Technologies and Applications (ICTA); pp. 52-53, 2022. [DOI: 10.1109/ICTA56932.2022.9962993](https://doi.org/10.1109/ICTA56932.2022.9962993).

- **[FECPS4YU]** Zeyu Li, Xuan Guo, Hanbo Jia et al.. “A 1.25-GS/s 14-bit pipelined ADC using a current-feedback flipped input buffer and large dither technique to achieve high linearity.” IEICE Electronics Express; vol. 21; no. 19; pp. 20240457-20240457, 2024. [DOI: 10.1587/elex.21.20240457](https://doi.org/10.1587/elex.21.20240457).

- **[RNRP3VQM]** Zeyu Li, Fangyuan Xu, Xuan Guo et al.. “An input buffer with opamp-based bootstrap circuit and cross-coupled substrate technique for 1.5-GS/s pipelined ADC in 40-nm CMOS process.” IEICE Electronics Express; vol. 22; no. 10; pp. 20250092-20250092, 2025. [DOI: 10.1587/elex.22.20250092](https://doi.org/10.1587/elex.22.20250092).

- **[DLDWSRMX]** Xiaoshuang Guo, Yangxin Xiang, Zihan Zheng et al.. “A 24-GHz Bandwidth 58.8-dB SNDR Input Buffer Based on Class-AB Enhanced Super Source Follower.” 2025 IEEE International Conference on Integrated Circuits, Technologies and Applications (ICTA); pp. 63-64, 2025. [DOI: 10.1109/ICTA68203.2025.11329604](https://doi.org/10.1109/ICTA68203.2025.11329604).

- **[4VVZMRMD]** Nannan Li, Lei Pei, Bin Liu et al.. “An Input Buffer with Replica-Based Nonlinearity Compensation for High-Speed ADCs.” 2025 IEEE International Conference on Integrated Circuits, Technologies and Applications (ICTA); pp. 55-56, 2025. [DOI: 10.1109/ICTA68203.2025.11329780](https://doi.org/10.1109/ICTA68203.2025.11329780).

- **[E4HP4VRY]** Nannan Li, Lei Pei, Bin Liu et al.. “A 14-bit 3 GS/s pipelined ADC featuring an input buffer with replica-based nonlinearity compensation in 28-nm CMOS technology.” Microelectronics Journal; vol. 168; pp. 107015, 2026. [DOI: 10.1016/j.mejo.2025.107015](https://doi.org/10.1016/j.mejo.2025.107015).

- **[77HKX23V]** Ewout Martens, Angelo Parisi, Anirudh Kankuppe et al.. “11.5 A Compact 7b 175GS/s Linearized Time-Interleaved Slope ADC with Switched Input Buffers.” 2026 IEEE International Solid-State Circuits Conference (ISSCC); vol. 69; pp. 198-200, 2026. [DOI: 10.1109/ISSCC49663.2026.11409101](https://doi.org/10.1109/ISSCC49663.2026.11409101).

- **[QRCJT5DZ]** Tao Liu, Xuan Guo, Hanbo Jia et al.. “A high-linearity input buffer and early-trigger scheme for GS/s pipelined ADCs.” Microelectronics Journal; vol. 174; pp. 107233, 2026. [DOI: 10.1016/j.mejo.2026.107233](https://doi.org/10.1016/j.mejo.2026.107233).

## 附录 C：图片与资料核验说明

### C.1 附件和版本

- 分类 key：`HEFG3LTV`，本次返回 45 条主文献、47 个 PDF 附件；两条主文献各有两个附件。附件数不等于独立论文数。
- 已识别相关版本组：`ZVCUCLPN`／`3ILPCVZH`（2020 ISSCC/JSSC）；`FBZ8DVAA`／`AMZFXGAJ`（2024 ISSCC/JSSC）；`H5EAYBPS`／`62CPDB27`（2025 ISSCC/JSSC）；`ANGSAUNX`／`IZ8STV8W`（CCSF 会议/期刊）；`4VVZMRMD`／`E4HP4VRY`（replica 补偿会议/期刊）。扩展稿可能有新增内容，这里按技术线索关联，不宣称两个文件逐字相同。
- `N7S2F5SW` 标题的 SSF 主要指 residue amplifier，不能据标题把整篇归为 SSF input buffer。
- `MQDUICAW` 附件第 3 页的文本提取出现不相关 SRAM 内容混入；本笔记截图使用经可视检查的第 2 页，关键结构说明核对该页及连续正文，没有将混入内容作为依据。
- 部分附件是 accepted manuscript／early access／带封面的版本，所以图注优先给 **PDF 从 1 开始计数的页码**，不机械等同期刊页码。
- 章节延续已提供大纲中系统、MOS、负载、SF、FVF 的顺序，并按本次指定主题扩展 SSF、PPSF、系统协同及验证内容。

### C.2 图源索引

| 本文图号 | 图像文件 | Zotero key | 原图号 | PDF 页码 |
|---|---|---|---|---|
| 1 | `学习记录/高速 ADC Input Buffer/attachment/14_fanout.png` | B5HLXYYN | Fig. 1 | 2 |
| 2 | `学习记录/高速 ADC Input Buffer/attachment/01_fvf_comparison.png` | B5HLXYYN | Fig. 2 | 2 |
| 3 | `学习记录/高速 ADC Input Buffer/attachment/02_ssf_essf.png` | DLDWSRMX | Fig. 1 | 1 |
| 4 | `学习记录/高速 ADC Input Buffer/attachment/03_differential_ssf.png` | MQDUICAW | Fig. 4 | 2 |
| 5 | `学习记录/高速 ADC Input Buffer/attachment/04_ppsf_bootstrap.png` | JI8G84VA | Fig. 11 | 7 |
| 6 | `学习记录/高速 ADC Input Buffer/attachment/06_ccsf.png` | IZ8STV8W | Fig. 2 | 2 |
| 7 | `学习记录/高速 ADC Input Buffer/attachment/05_body_buffer.png` | PKP4WR5K | Fig. 3 | 3 |
| 8 | `学习记录/高速 ADC Input Buffer/attachment/11_body_cross_coupling.png` | RNRP3VQM | Fig. 6 | 4 |
| 9 | `学习记录/高速 ADC Input Buffer/attachment/07_sacc.png` | AMZFXGAJ | Figs. 13–14 | 7 |
| 10 | `学习记录/高速 ADC Input Buffer/attachment/13_hold_kickback.png` | MQDUICAW | Fig. 3 | 2 |
| 11 | `学习记录/高速 ADC Input Buffer/attachment/09_hierarchy_interface.png` | GHM37WIL | Fig. 2 | 2 |
| 12 | `学习记录/高速 ADC Input Buffer/attachment/08_hierarchy_timing.png` | GHM37WIL | Fig. 3 | 2 |
| 13 | `学习记录/高速 ADC Input Buffer/attachment/10_active_bootstrap.png` | 62CPDB27 | Fig. 9 | 7 |
| 14 | `学习记录/高速 ADC Input Buffer/attachment/12_pvt_mc.png` | RNRP3VQM | Figs. 12–13 | 5 |

### C.3 适用范围

本笔记用于原理学习和建立设计／验证方法。所有近似式均应回到具体拓扑、PDK 和采样时序验证。查阅时优先按 Zotero key 和 DOI 回到原文，并以完整测试条件解读指标；书目中的标称 ADC 位数不等于实际 ENOB，论文中的 buffer 芯片级系统结果也不等于孤立电路的性能。