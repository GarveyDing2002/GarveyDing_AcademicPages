---
title: Dither-Based Calibration：原理、架构与建模
date: 2026-04-01
excerpt: 按误差对象、注入位置和统计提取方法梳理 Dither-Based Calibration，并给出行为建模路线。
tags:
  - 学习记录
  - adc
  - dither
  - background-calibration
---

> **核心定位**
> 按误差对象、注入位置和统计提取方法梳理 Dither-Based Calibration，并给出行为建模路线。

---

面向Pipeline、Pipelined-SAR与Time-Interleaved ADC的体系化研究

聚焦：级间增益误差、位权/电容失配、比较器失调、时间偏斜、增益非线性与相关数字后台校准

整理与撰写：OpenAI ChatGPT 日期：2026年4月

|说明：本报告优先覆盖IEEE旗舰期刊/会议（JSSC、ISSCC、VLSI、TCAS-I/II、TVLSI、CICC等）中的dither相关ADC校准工作；同时少量补充非IEEE但高度相关的论文，用于补全技术脉络、实现细节与方法比较。|
|---|


> **层次化结构**
> 本版将原笔记的并列分点重构为 **6 个主章节 → 主题小节 → 具体知识点**。原有正文、公式、表格与参考资料保持不变，主要调整标题层级与导航结构。

## 目录

1. 总体框架：研究范围、基本原理与统计基础
   - 1.1 执行摘要
   - 1.2 检索策略、范围与阅读方法
   - 1.3 Dither-Based Calibration 的基本原理
   - 1.4 从数学与统计视角理解 Dither
2. Dither 注入与硬件实现
   - 2.1 注入方式与硬件实现：真正决定成败的工程细节
3. 不同 ADC 架构中的技术演进
   - 3.1 按架构梳理文献脉络
4. 代表性旗舰文献与方法解读
   - 4.1 代表性IEEE旗舰文献深度解读
5. 关键矛盾、研究启发与未来方向
   - 5.1 关键技术矛盾与设计权衡
   - 5.2 对你当前研究方向的具体启发
   - 5.3 未来值得重点跟踪的研究方向
6. 结论、参考文献与建模附录
   - 6.1 结论
   - 6.2 参考文献（优先列出IEEE旗舰期刊/会议）
   - 6.3 附录 A：读文献时建议重点追问的十个问题
   - 6.4 附录 B：面向 Matlab / Verilog-A 联合仿真的实施建议
   - 6.5 附录 C：阅读与建模这类文献时最容易犯的误区

## 1. 总体框架：研究范围、基本原理与统计基础

### 1.1 执行摘要

基于dither的ADC校准，本质上是在不打断正常转换的前提下，向输入端、残差通路、CDAC、比较器阈值、参考时钟或输入缓冲等关键节点注入可控伪随机扰动，再利用相关检测、统计平均、数字混频、窗口检测、LMS/符号LMS或自相关提取等方法，把原本与输入信号强耦合、难以直接观测的误差参数“搬运”到可测量的统计量上。因此，dither既是一种“激励”，也是一种“解耦工具”：它一方面为参数辨识提供持续存在的观测通道，另一方面通过随机化把确定性失真打散为噪声状项，从而降低spur并减轻输入依赖性。

从文献演进看，dither-based calibration大致经历了四个阶段。第一阶段是以pipeline ADC为核心的相关型后台校准，典型目标是级间增益误差、残差放大器失真、memory error与harmonic distortion；第二阶段是把dither思想迁移到two-step SAR与pipelined-SAR ADC，用于位权、电容失配和动态放大器增益漂移校准；第三阶段是把dither引入time-interleaved ADC，用于时间偏斜与通道相对失调提取；第四阶段则开始出现更复杂的“多重dither”“互补dither”“全局dither注入”“亚稳态dither”“subtracting/counteracting dither”等方案，目标是在保持后台实时性的同时，降低动态范围损失、提高收敛速度并抑制dither泄漏与额外spur。

对你当前的研究场景——尤其是pipelined-SAR ADC中级间增益误差、比较器相对失调、bit-weight误差以及time-interleaving场景下的time-skew——最有价值的结论有三点。其一，若目标是“在线、连续、能跟踪PVT”的背景校准，那么dither+相关/LMS几乎仍是最通用的主线；其二，真正决定方案优劣的，不只是算法本身，而是dither的注入位置、注入幅度、数字消除路径以及输入干扰抑制机制；其三，未来高价值方向不是简单重复“注入PN再做LMS”，而是把dither与结构冗余、交替比较器、窗口检测、数字干扰抵消、分段线性建模、甚至自相关/机器学习辅助提取进行深度结合。


### 1.2 检索策略、范围与阅读方法

本次整理以“ADC + dither + calibration”为主线检索词，围绕pipeline ADC、pipelined-SAR ADC、two-step SAR ADC、time-interleaved SAR/pipe-SAR ADC四类架构展开，重点筛选IEEE Journal of Solid-State Circuits（JSSC）、ISSCC、VLSI Symposium、IEEE Transactions on Circuits and Systems I/II（TCAS-I/II）、IEEE Transactions on Very Large Scale Integration Systems（TVLSI）以及少量与实现高度相关的CICC/ISCAS工作。

由于浏览环境不能稳定直接打开IEEE Xplore全文，本报告采用“多源交叉核验”的方式保证文献信息可靠性：一方面使用机构知识库、作者主页、大学论文仓储、DOI元数据页面、会议摘要页与开源镜像页面确认题目、作者、期刊/会议、年份、卷期和DOI；另一方面结合可访问的论文摘要、教程讲义和综述页提炼方法要点，避免仅凭二手转述下结论。

阅读与归纳方法上，本报告并不按“年份罗列论文”这种低信息密度方式展开，而是先建立一套统一分析框架：误差对象是什么、dither注入到哪里、参数怎样从统计量中提取、输入干扰如何被抑制、收敛速度由什么决定、代价落在模拟端还是数字端。这样做的好处是，即便不同论文面向的架构不同，你仍然能把它们映射到同一个方法论坐标系中。

需要强调的是，dither-based calibration与“任何注入随机噪声的ADC技术”并不完全等同。严格来说，只有当dither承担了参数辨识、误差去相关、spur散射、输入独立性增强或数字补偿辅助这几类核心功能之一，才应视为本报告的核心对象。对只把dither用于纯线性化、量化噪声打散而没有形成校准闭环的工作，本报告会纳入，但会明确标注其角色是“线性化为主”而非“参数提取为主”。


### 1.3 Dither-Based Calibration 的基本原理

在很多ADC里，最难校准的误差都不是“看不见”，而是“看得见但与输入强相关”。例如pipeline或pipelined-SAR中的级间增益误差，会在不同码区表现为不同大小的残差畸变；CDAC位权误差会混入正常量化过程；time-interleaved ADC中的timing skew会随着输入频率、幅度和相位而变化。若没有额外激励，观测到的输出统计量往往既含有输入信息，也含有误差信息，二者纠缠在一起。dither的作用，就是人为引入一个已知且可追踪的随机序列，把误差“调制”到一个可分离的统计通道。

最经典的思路是伪随机二值或多值序列d[n]注入到某个关键节点，再在数字端对输出y[n]与d[n]做相关。若输入x[n]与d[n]统计独立，且d[n]的均值为零，那么长期平均后，E{x[n]d[n]}趋近于零，而与注入路径相关的误差项会留下非零均值。这样就相当于做了一次“同步检测”：输入被平均掉，误差被提取出来。

从这个角度看，dither-based calibration与通信中的扩频、锁相中的相敏检波、系统辨识中的随机激励具有内在一致性。其并不神秘，关键在于三件事：第一，dither必须足够“可辨识”，也就是注入后确实能影响被校准参数对应的输出统计量；第二，dither不能过度侵入正常信号通路，否则会带来动态范围损失、残差摆幅增加甚至后级饱和；第三，数字端必须具备与模拟端注入路径相匹配的消除或估计结构，否则即便校准量被提取到了，也可能同时留下难以处理的泄漏spur。

因此，真正好的dither方案不是“注入越大越好”。理论上，大dither往往能带来更好的可观测性、更快的收敛和更强的去相关能力；但工程上，大dither也会占用冗余范围、压缩信号摆幅、提升残差峰值、加重比较器决策负担、恶化SNDR。因此，很多优秀工作实际上是在做“高可观测性与低侵入性”的折中优化。比如signal-dependent dithering通过让dither幅度随输入/码区变化，使其在关键区间足够大、在非关键区间尽量小；counteracting或subtractive dithering则在模拟端或数字端抵消dither带来的摆幅增量，从而减轻副作用。


### 1.4 从数学与统计视角理解 Dither

把dither-based calibration写成统一模型，最直观的表达是：y[n] = F(x[n], θ, d[n]) + q[n] + η[n]。其中θ表示待校准参数，可能是级间增益、位权、失调、时间偏斜或非线性系数；d[n]是伪随机激励；q[n]是量化误差；η[n]是热噪声、比较器噪声等其他随机扰动。校准的目的不是直接恢复y[n]，而是从y[n]中构造一个统计量z[n]，使得它对θ敏感、对x[n]不敏感。

最常见的构造方式有四类。第一类是相关型：z = E{y·d}、E{y·d1·d2}或与符号相关的简化形式。它适用于模拟端有明确注入序列、数字端能够同步获得序列副本的场景。第二类是窗口型：只在某些码区或比较器临界边界附近开启观测，因为这些区域对某个误差参数最敏感。第三类是自相关/统计量型：比如timing skew校准中利用相邻通道样本差分、方差、绝对相关或自相关斜率估计误差。第四类是decision-time / metastability型：并不显式测模拟电压，而是利用比较器亚稳态概率或决策时间作为误差映射。

从收敛算法看，LMS之所以广泛流行，不是因为它最优，而是因为它几乎天然适配“有噪声、慢变量、需要在线更新”的背景校准场景。对于大多数ADC后台校准，目标函数并不需要非常精确，只要梯度方向基本正确，就可以逐步把误差压下去。因此，很多论文选择sign-LMS、reduced-complexity LMS或带泄放项的LMS，而不是更复杂的RLS或牛顿法。尤其在高速ADC里，数字复杂度和时钟功耗本身就是一条设计约束。

但是，LMS并不自动等于好校准。真正决定收敛质量的是梯度估计是否被输入干扰污染。如果构造的z[n]里仍保留较强的输入相关分量，那么步长再怎么优化，收敛也会慢，甚至会漂移到错误值。这也是为什么从Shu和Song的signal-dependent dithering，到后来的partially split structure、counteracting dither、global dither injection、digital input-interference cancellation等工作，大家都在不断改造“统计量提取这一步”，而不仅仅是在优化LMS本身。

另一个经常被忽视的问题，是dither分布与谱形。很多实现直接使用LFSR产生的±1 PN序列，因为硬件简单；但当目标是降低可见spur、兼顾线性化和校准、或者需要在多通道系统中避免通道间相关时，二值PN未必最佳。近年来出现的多值dither、互补dither、全局dither、亚稳态dither，本质上都是在重新设计“激励的统计结构”，以让误差可提取、而副作用更小。

**表1 按误差对象分类的dither校准方法框架**

|**误差对象**|**典型注入位置**|**数字提取方式**|**主要优点**|**主要风险**|
|---|---|---|---|---|
|级间增益误差 / 残差增益漂移|MDAC残差通路、动态放大器输入、后级关键路径|相关检测、LMS、窗口检测、干扰抵消|PVT跟踪能力强，适合open-loop / dynamic amplifier|dither会抬高残差摆幅，易牺牲动态范围|
|位权误差 / 电容失配|CDAC单元、电容阵列、分裂子阵列节点|相关检测、时间域邻近检测、部分拆分结构|可直接针对bit-weight，适合SAR与pipelined-SAR|输入相关分量大时收敛较慢|
|比较器失调 / 相对失调|比较器阈值、交替比较器、ping-pong comparator|统计平均、码分布检测、交替通道比较|硬件较省，适合交替比较器结构|若无冗余或无dither，易与输入偏置混淆|
|时间偏斜 timing skew|参考时钟、输入缓冲、公共模节点、局部/全局dither时钟|方差、自相关、数字混频、参考通道、窗口检测|对TI ADC最关键，能在后台持续对齐采样时刻|输入依赖性与校准spur是核心难点|
|增益非线性 / 谐波失真 / memory effect|残差放大器、前端缓冲、多重dither路径|多项式/分段线性估计、相关提取、后台数字补偿|可支持低增益放大器和高速结构|参数维数上升，数字复杂度增加|
|纯线性化辅助|sub-ADC和MDAC双侧、输入与残差双侧|subtract / counteract / multi-level dither|改善小信号SFDR，抑制确定性spur|不一定形成完整参数辨识回路|

表1的核心信息是：dither不是单一技巧，而是一组“激励—提取—补偿”的联合设计方法。任何一篇论文，都可以被拆解到这三个维度上来比较。


## 2. Dither 注入与硬件实现

### 2.1 注入方式与硬件实现：真正决定成败的工程细节

从电路实现角度，dither注入位置大体可以分为五类。第一类是输入端注入，优点是结构直观、可覆盖全链路误差，但副作用也最大，因为它直接与真实信号叠加。第二类是残差路径注入，典型见于pipeline与pipelined-SAR ADC，用于提取级间增益误差、增益非线性或位权误差。第三类是CDAC或dummy capacitor注入，这在SAR和pipelined-SAR中特别常见，因为实现简单、与bit-weight天然相关。第四类是比较器阈值或交替比较器路径注入，适合校准失调或做相对误差辨识。第五类是时钟/输入缓冲注入，主要用于time-interleaved ADC中的timing skew校准。

注入路径一旦确定，接下来就要回答“dither是否需要在数字端完全移除”。理论上，若dither只是为了参数辨识而非线性化，那么最好做到完全可消除；否则校准完成后，系统中仍残留可见spur或额外噪声底。可问题是，真实电路里dither往往经过非线性、失配、有限增益、带宽限制与噪声耦合，导致数字端即便有理想副本，也很难100%抵消。因此，很多新方案的改进重点不在‘如何更强地注入’，而在‘如何让注入后的残留更容易被抵消或本身更无害’。

例如counteracting dither的核心思想，是在两个路径同时注入符号相反或效果互补的dither，让其在残差摆幅层面彼此抵消，而在参数辨识层面仍然保留足够信息；subtractive dither则在数字端显式扣除已知dither成分；global dither injection则把局部各通道注入改为全局公共点注入，以减少局部路径失配引入的二次误差；metastable dither则利用比较器接近亚稳态时的统计敏感性，以更低模拟开销辨识非线性增益项。

从实现代价上看，模拟端开销常常并不大，增加几只开关、若干单位电容、简单LFSR或注入DAC即可；真正难的是时序与接口。尤其在高采样率pipelined-SAR和TI ADC中，dither必须与采样、放大、比较和后台更新严格对齐，否则提取到的不是目标误差，而是时序错位后的混合量。这一点对你后续若要做Verilog-A/Matlab联合建模尤其重要：一定要把dither注入的相位、占空比、持续时间和数字端对齐关系建清楚。


## 3. 不同 ADC 架构中的技术演进

### 3.1 按架构梳理文献脉络

#### Pipeline ADC：dither背景校准的起点与主战场

如果从“形成成熟设计范式”的角度看，dither-based calibration最早、也最系统的战场就是pipeline ADC。原因很直接：pipeline ADC把高速、较高分辨率和多级残差放大三件事绑在一起，使得级间增益误差、MDAC失配、残差放大器有限增益、memory effect和谐波失真都被显著放大；与此同时，pipeline又天生有冗余码与分级结构，非常适合做后台参数提取。

在较早期工作中，研究者已经意识到：如果只靠前台自校准，虽然精度高，但无法跟踪PVT变化；如果只靠后端数字拟合，又很难在不额外打断转换的情况下稳定估计参数。因此，基于PN/dither的相关型后台校准逐渐成为核心路线。Chiu等人在2004年的LMS自适应背景校准工作、McNeill等人的split-ADC思路以及Keane关于interstage gain / memory effect的系列工作，为后续很多方案奠定了统计提取框架。

Shu和Song于2008年发表在JSSC上的经典论文，是dither-based calibration真正走向工程可用的重要里程碑。该工作提出signal-dependent dithering，核心贡献不是简单“用更大dither”，而是让大dither在不明显牺牲输入范围的前提下提升测量精度，并缩短输入去相关所需时间。它把早期固定幅度PN注入存在的两大痛点——动态范围压缩与长时间平均——一起正面处理掉，因此直到今天仍被许多后续论文反复引用。

再往后，Ali等人在ADI体系下把相关型后台校准推向了多GHz RF-sampling pipeline ADC。2010年的16-bit 250-MS/s IF-sampling pipelined ADC、2014年的14-bit 1-GS/s RF-sampling pipelined ADC、2016年的2.5/5-GS/s RF-sampling ADC with background calibration and dither，以及2020年的12-bit 18-GS/s RF-sampling ADC，说明dither/相关型方法并不只是低速实验室方案，而是可以被工业界用在极高速度、极高带宽的量产级架构中。

近几年pipeline ADC方向的一个明显趋势，是从“校准线性增益误差”转向“同时校准增益非线性、harmonic distortion甚至memory effect”。这与工艺演进高度相关：在先进节点里，高增益线性放大器越来越难做，open-loop residue amplifier、dynamic residue amplifier、ring-based amplification等低功耗高速度方案越来越常见，但它们的增益与线性度天生更不稳定。因此，多重dither、窗口检测、互补dither、subtractive dither等工作逐渐活跃，它们本质上都是在为“低模拟余量时代”的ADC寻找更强的数字辅助。

#### Two-Step SAR 与 Pipelined-SAR：dither思想的第二波扩张

当SAR ADC在中高分辨率、较高采样率场景中快速崛起后，dither-based calibration也自然迁移到了two-step SAR和pipelined-SAR结构。与传统pipeline相比，这些架构的级数更少、功耗更低、数字可编程性更强，但代价是残差放大器常常采用动态/open-loop方式，增益易受PVT影响，而且前后级量化之间的位权映射更直接，输入干扰也更难压制。

Zhou、Xu和Chiu在2015年JSSC上的two-step SAR工作具有代表性。它不是最纯粹意义上的“经典PN dither相关”，但其time-domain proximity detector本质上利用了边界附近的统计敏感性来做background bit-weight calibration，说明在SAR世界里，dither思想可以不拘泥于单一实现形式，而是演化成“人为增强边界可观测性”的更一般框架。

随后，围绕pipelined-SAR bit-weight与interstage gain校准，出现了多条分支：一条是把dither直接注入CDAC或关键通路，再做相关/LMS提取；另一条是引入partially split structure、noise quantizer、counteracting dither等结构，尽量削弱输入对校准量的污染；还有一条是减少或避免dither，通过复用后级比较器、利用决策时间或利用电容比先验来提取误差，但这类方案在真正的后台PVT跟踪能力上往往不如dither路线稳健。

从可访问文献看，Sun等人在2020年前后连续发表了几篇很有参考价值的短文：包括pipelined-SAR ADC中的dither-based bit-weight calibration、pipeline ADC中的counteracting dither，以及基于signal-dependent dithering的变体。这些工作的重要性不在于芯片指标一定最强，而在于它们非常集中地讨论了同一个核心问题：怎样降低dither副作用、怎样加快收敛、怎样把输入干扰降到可接受水平。对于做Matlab行为建模的人，这比单纯看一篇最终芯片论文更有启发。

2025年Wang等人在TCS-I发表的1-GS/s 12-bit pipelined-SAR ADC，把dither-based background calibration同时用于interstage gain和comparator offset，是一个很值得重点关注的新节点。它表明在更现代的pipelined-SAR实现中，研究者已经不满足于只校准单一线性参数，而是开始把多个后台校准任务统一到一个更紧凑的dither框架中。这对你的研究尤其相关，因为你本身就关注级间增益、冗余和比较器相对失调等问题。

同样值得注意的是2025年的metastable-dither工作。它把亚稳态本身当作敏感探针，用更低的模拟注入开销提取interstage gain nonlinearity，反映出一个新趋势：未来dither不一定总表现为“额外加一个模拟激励电压”，也可以是“利用系统原本存在的随机边界行为作为隐式dither源”，从而把校准做得更轻、更嵌入式。

#### Time-Interleaved ADC：从输入依赖问题到全局dither

对time-interleaved ADC而言，timing skew是最顽固也最关键的误差之一。因为它不是一个简单的码域偏置，而是“采样时刻被错开”所引起的输入导数加权误差，所以任何纯统计法都容易出现输入依赖：输入频率太低时不敏感，输入过于窄带或存在盲点时估计不准，输入统计不满足假设时收敛会失败。

因此，TI-ADC中的dither校准与pipeline中的dither校准在精神上相同，但在工程重心上不同。前者最核心的问题不是如何在冗余码里提取一个固定误差，而是如何构造一个“输入独立”的时间误差观测量。早期方法常利用辅助ADC、参考时钟、数字混频或方差估计。2017年Song等人提出的variance-based timing-skew calibration通过window detector显著加快了方差估计收敛；2018年Kang等人的virtual-timing-reference方案则通过推迟参考采样边，抑制了传统校准spur，并使校准精度对输入统计更不敏感。

2018年Lin等人的digital-mixing timing-skew calibration把数字混频思想用于16通道2.6-GS/s TI SAR ADC；其关键启发是，把timing skew提取问题转化到某个调制/解调后的低频统计量上。此类方法的优点是数字化程度高，缺点是往往会受到输入带宽、极限环和局部最优的影响。因此，后续工作不断在“可观测性”“输入独立性”“spur抑制”和“模拟代价”四个维度之间寻找平衡。

2024年一个非常重要的变化，是全局dither与输入缓冲注入思路的兴起。Cao等人在JSSC上报道的12-GS/s 12-bit TI ADC using input-independent timing-skew calibration with global dither injection，明确指出局部每通道注入会受到通道间注入路径失配影响，于是改从输入缓冲的公共点进行全局dither注入，以获得对输入类型更独立的校准量。这个思路非常值得重视，因为它意味着TI系统中的dither不再只是“各通道分散注入”，而是“在全局公共前端创建统一校准参考”。

同年，Tao等人在ISSCC 2024的4.8-GS/s 7-ENoB TI SAR ADC工作，则把dithered reference clock at input buffer用于background timing-skew calibration，同时配合bit-distribution-based ping-pong comparator offset calibration。这篇论文的重要意义在于：它把timing skew和comparator relative offset两个长期困扰TI SAR ADC的问题放进了一个统一的后台框架里，体现出“多误差联合校准”的强烈趋势。

2025年的Gu等人进一步把autocorrelation-based background timing-skew calibration做到了1-GS/s 11-bit TI SAR ADC上，强调robust、fast and accurate。与dither显式注入相比，自相关法似乎更“纯数字”，但从更宽泛的观点看，它仍然属于通过构造辅助统计量来实现输入分离的背景校准范式。换句话说，在TI ADC世界里，dither法、自相关法、数字混频法、方差法、虚拟参考法并不是互斥的，它们是同一问题的不同建模与实现。


## 4. 代表性旗舰文献与方法解读

### 4.1 代表性IEEE旗舰文献深度解读

#### Shu & Song, JSSC 2008：Signal-Dependent Dithering 的范式价值

这篇论文之所以经典，不是因为它最早提出背景校准，而是因为它针对固定幅度PN dither的两个真实工程痛点给出了优雅回答：一是大dither会吞噬输入范围，二是小dither虽然副作用小，但要平均很久才能从输入里“洗”出误差。Signal-dependent dithering通过让dither与输入/码区状态相关，在需要高可观测性的区间给出更强激励，在无需强激励时降低影响，从而兼顾可测性与动态范围。对今天的很多论文而言，所谓counteracting、subtractive、adaptive或window-based dither，本质上都可以看作是在继续回答Shu和Song提出的同一个问题。

#### Ali 等，JSSC 2014：工业级高速Pipeline ADC中的背景校准

Ali等人的14-bit 1-GS/s RF-sampling pipelined ADC表明，相关型背景校准和dither并不是“学术上可行、工业上太复杂”的方法。恰恰相反，在高带宽RF-sampling pipeline ADC里，前端线性度、级间误差和memory effect都很难单靠模拟设计压住，此时数字辅助不是锦上添花，而是架构成立的必要条件。其论文摘要中特别提到，校准信号中嵌入有效dithering，用于打破收敛对输入幅度的依赖，这一点对理解后续所有“输入独立性增强”方案非常关键。

#### Zhou/Xu/Chiu, JSSC 2015：边界敏感型 bit-weight 校准

这篇two-step SAR论文的time-domain proximity detector非常值得你细读。它说明了一个重要事实：在SAR类ADC里，不一定非得像pipeline那样直接在残差上做PN相关，完全可以转而利用比较边界附近的时间/统计敏感性来估计位权误差。从方法论上看，它把“dither思想”扩展到了“通过人为设计边界观测器来增强参数可辨识性”这一更普适的层面。

#### Song 等，JSSC 2017：Variance-Based Timing-Skew Calibration

该工作引入window detector改善方差估计精度和速度，是TI SAR ADC timing-skew校准的重要节点。它说明：在TI系统里，校准难点不是只有估计公式，还包括如何让估计器在有限样本数下收敛得足够快、足够稳。窗口检测器的引入，本质上是一种统计预处理，相当于先筛选“对skew更敏感”的样本再做更新。

#### Kang 等，JSSC 2018：Virtual Timing Reference

这篇论文的亮点在于真正把“输入独立性”和“校准spur抑制”同时摆上台面。它指出传统参考采样容易把校准动作本身变成可见spur，于是通过deferred reference sampling edge构造virtual timing reference。其结果不是单纯精度提高，而是让背景校准更像一个“不会被用户看见”的系统过程。

#### Lin 等，JSSC 2018：Digital Mixing for TI SAR ADC

数字混频法的意义，在于把高频时域误差检测变成低频统计量提取问题。对硬件实现者而言，这常常意味着可以用更简单的数字滤波与积分结构替代更复杂的模拟参考通道。其代价是模型假设更强，因此在极端输入条件下可能存在带宽或极限环问题。

#### Sun 等，Electronics Letters 2020：Partially Split Structure 加速 bit-weight 收敛

这类工作虽非JSSC/ISSCC，但对行为建模极有价值。其贡献不是追求最高芯片指标，而是直接讨论为什么普通dither-based bit-weight calibration会慢：因为输入分量太强，相关统计量被污染。部分拆分结构的目的，就是在结构层面削弱输入干扰，从根上加快收敛。对你的Matlab模型，这是非常实用的启发。

#### Cao 等，JSSC 2024：Global Dither Injection

这篇12-GS/s 12-bit TI ADC工作把dither从“各通道局部注入”升级为“输入缓冲公共点全局注入”。其背后的思想非常先进：如果各通道注入路径本身失配，那么你注入的不是一个理想参考，而是一组互不一致的参考，残余误差会成为新的校准下限。因此，全局dither不是简单改位置，而是重新定义了TI系统中参考激励的生成方式。

#### Tao 等，ISSCC 2024：Skew 与 Offset 的联合背景校准

这篇ISSCC论文非常契合你当前兴趣。它把dither-based background timing-skew calibration与bit-distribution-based ping-pong comparator offset calibration结合起来，说明高速TI SAR ADC已经进入“多误差协同处理”阶段。也就是说，未来真正高价值的论文，不会只解决单一误差，而是会在一个统一的架构/时序框架下同时处理多个二级失配源。

#### Wang 等，TCS-I 2025 与 Chen 等，TVLSI 2025：pipelined-SAR的新前沿

2025年的两篇工作非常值得跟踪。前者把interstage gain与comparator offset纳入统一dither背景校准框架；后者利用metastable dither校准interstage gain nonlinearity，显示出校准对象正从“线性误差”扩展到“非线性与统计边界行为”。这意味着pipelined-SAR未来的研究热点，极可能围绕多参数联合估计、低副作用dither和轻量级数字补偿展开。


## 5. 关键矛盾、研究启发与未来方向

### 5.1 关键技术矛盾与设计权衡

第一组矛盾是“收敛速度”与“动态范围损失”。dither越大，参数可观测性越好，LMS梯度越干净，收敛往往越快；但dither越大，也越容易增加残差摆幅、占用冗余范围、抬高噪底。因此，不少论文在标题里写的是某种校准对象，但真正贡献其实是解决了这组矛盾。

第二组矛盾是“输入独立性”与“实现复杂度”。要做到真正输入独立，通常需要参考路径、辅助观测器、窗口控制、全局注入或更复杂的数字处理；但ADC是高吞吐系统，任何额外电路都会带来功耗、面积和时序压力。所以很多方案宁愿保留一定输入假设，只要在目标应用的信号类型上足够好即可。

第三组矛盾是“模拟端简洁”与“数字端可校”。现代ADC越来越愿意牺牲一点模拟本征精度，换取更高速度和更低功耗，再靠数字校准补回来。可校准的前提是误差要“可辨识”；如果结构选得太激进，虽然速度上去了，但可辨识性很差，最终数字端也救不回来。dither恰好承担了在激进模拟架构与可校数字后端之间搭桥的角色。

第四组矛盾是“单参数校准”与“多参数耦合”。现实里，gain error、comparator offset、bit-weight error、time-skew并不总是独立存在。dither若只为一个参数设计，往往会把别的误差折叠进统计量中。因此，多误差联合校准将越来越重要，但这也意味着dither设计要从单一PN序列升级为多序列、互补序列或带结构约束的序列集。

第五组矛盾是“模型优雅”与“芯片可落地”。很多行为级上很好用的校准量，在晶体管级并不容易稳定实现；反过来，一些芯片级实现非常高效，但其抽象模型并不漂亮。做研究时，最容易忽略的是这两者的落差。你在Matlab里看到的一个“完美收敛”统计量，落到版图后可能被电容失配、开关注入、边沿漂移或多相时钟耦合破坏。因此，建模时尽量把注入幅值失配、序列不匹配、数字延时偏差、比较器噪声和有限统计窗口一并纳入。


### 5.2 对你当前研究方向的具体启发

结合你关注的pipelined-SAR ADC、后台LMS、比较器交替结构与time-skew问题，我认为最值得优先深入的研究抓手有四个。

第一，若你的主目标是级间增益误差后台校准，建议优先建立“CDAC注入型”和“比较器阈值注入型”两套并行行为模型。前者更贴近传统相关/LMS路径，便于理解残差摆幅、副作用和数字消除；后者更适合研究相对失调与位权边界统计。两种路径不应只比较收敛速度，还要比较对输入幅度、输入频率和比较器噪声的敏感度。

第二，若你计划同时校准gain与offset，不要把它们当作完全独立的两个LMS环路。更稳妥的做法是先分析两种dither对应统计量的正交性，确认$E[d_{gain}d_{offset}]$是否接近零；若不正交，就要考虑交替更新、分时注入、不同序列编码或先粗后细的两阶段流程。否则两个环路可能互相拉扯。

第三，针对time-interleaved场景，建议把“局部dither注入”和“全局dither注入”都建出来。你会很快看到一个常被忽略的事实：当局部注入路径存在失配时，即使理想算法成立，最终剩余timing skew也会被注入路径误差钳住下限。这正是近年global dither injection受重视的原因。

第四，若你打算把Matlab算法迁移到Verilog-A或做电路联合仿真，建议优先选择统计量简单、时序关系清晰、更新律低复杂度的方案。例如相关+sign-LMS或窗口检测+积分更新往往比高阶矩估计更容易在AMS环境里稳定运行。不要一上来就追求最复杂的算法，先确保在晶体管噪声与有限采样窗口下仍能收敛。

如果把这些建议再进一步收束成一个最有论文潜力的方向，我会建议你考虑“面向交替比较器pipelined-SAR ADC的联合dither背景校准”：通过一个主dither提取interstage gain，配合一个弱辅助dither或码分布统计提取alternate comparator relative offset，再用数字输入干扰抵消压低两个统计通道之间的串扰。这个方向既有明确文献基础，又仍然存在可创新空间。

**表2 代表性Pipeline / Pipelined-SAR 文献（节选）**

|**年份**|**架构**|**代表文献**|**核心贡献**|
|---|---|---|---|
|2004|Pipeline ADC|Chiu et al., TCAS-I|LMS自适应背景校准，奠定统计提取框架|
|2005|Pipeline ADC|Keane et al., TCAS-I|级间增益背景校准，适合PVT跟踪|
|2008|Pipeline ADC|Shu & Song, JSSC|Signal-dependent dithering，兼顾可观测性与动态范围|
|2010|Pipeline ADC|Ali et al., JSSC|16b 250MS/s IF-sampling背景校准|
|2014|Pipeline ADC|Ali et al., JSSC|1GS/s RF-sampling，dither打破输入幅度依赖|
|2015|Two-step SAR|Zhou et al., JSSC|background bit-weight calibration using time-domain proximity detector|
|2020|Pipelined-SAR|Sun et al., Elex|dither-based bit-weight calibration + partially split structure|
|2020|Pipeline ADC|Sun et al., Elex|counteracting dither降低摆幅副作用|
|2022|Pipeline / Pipe-SAR|Ding et al., Elex|multiple dithers校准gain error与gain nonlinearity|
|2024|Pipeline ADC|Ding et al., Elex|complementary dithering + calibration windows detector|
|2025|Pipelined-SAR|Wang et al., TCS-I|联合后台校准interstage gain与comparator offset|
|2025|Pipelined-SAR|Chen et al., TVLSI|metastable dither用于gain nonlinearity校准|
|2026|Pipeline ADC|Xu et al., Sensors|subtractive dither，提升线性度并控制SNDR损失|

**表3 代表性Time-Interleaved ADC 文献（节选）**

|**年份**|**架构**|**代表文献**|**核心贡献**|
|---|---|---|---|
|2011|TI Flash ADC|El-Chammas & Murmann, JSSC|background timing-skew calibration的早期经典|
|2017|TI SAR ADC|Song et al., JSSC|fast variance-based timing-skew calibration|
|2018|TI SAR ADC|Kang et al., JSSC|virtual timing reference，抑制calibration spurs|
|2018|TI SAR ADC|Lin et al., JSSC|digital-mixing timing-skew calibration|
|2024|TI ADC|Cao et al., JSSC|global dither injection实现输入独立timing-skew校准|
|2024|TI SAR ADC|Tao et al., ISSCC|dither-based skew + ping-pong comparator offset联合校准|
|2025|TI SAR ADC|Gu et al., JSSC|robust / fast / accurate autocorrelation-based calibration|


### 5.3 未来值得重点跟踪的研究方向

其一，多误差联合校准。未来的优秀工作很可能不再单独讨论gain、offset、bit-weight或skew，而是讨论如何在统一序列设计和统一数字后端下同时估计多个耦合参数。

其二，低副作用dither。包括互补dither、subtractive dither、多值dither、全局dither与亚稳态dither等，都指向同一个目标：在保证可观测性的前提下，把dither对动态范围、摆幅和spur的影响降到最低。

其三，结构感知型后台校准。与其把ADC当成黑箱，不如利用结构先验，例如交替比较器、分裂CDAC、冗余码、窗口边界、决策时间、ring amplifier偏置状态等，把校准量设计得更“懂电路”。

其四，数字输入干扰抵消。很多过去看似“算法不够好”的dither方案，本质上输在输入分量污染。谁能更有效地在数字端剥离输入相关项，谁就能在不增大dither幅值的前提下取得更快更稳的收敛。

其五，建模—电路闭环协同。未来高水平论文越来越强调行为模型、RTL/Verilog-A实现和芯片结果之间的闭环一致性。只停留在Matlab仿真往往不够；而若能把模型中的统计量和芯片中的实际时序/注入路径一一对上，会显著提高工作的说服力。


## 6. 结论、参考文献与建模附录

### 6.1 结论

总体而言，ADC中的dither-based calibration已经从早期的“用PN测一个误差参数”的技巧，发展成一整套跨架构、跨误差类型、跨模拟与数字边界的设计哲学。它之所以长期有效，不是因为它形式固定，而是因为它抓住了高性能ADC校准的本质：当误差无法被直接测量时，就主动设计一个可控扰动与统计观测通道，把误差从输入里分离出来。

对pipeline ADC而言，dither是让低增益/高速残差放大器可用的关键数字助手；对pipelined-SAR而言，dither是连接位权、增益、失调与后台LMS的核心纽带；对TI ADC而言，dither则逐渐成为实现输入独立timing-skew校准的重要工具。若你后续要在该方向上做深入研究，最有价值的工作不是简单重复已有算法，而是围绕“更低副作用、更强输入独立性、更多误差联合校准、更易AMS落地”这四条主线提出自己的结构创新。


### 6.2 参考文献（优先列出IEEE旗舰期刊/会议）

> **[1]** A. N. Karanicolas, H.-S. Lee, and K. L. Bacrania, “A 15-b 1-Msample/s Digitally Self-Calibrated Pipeline ADC,” IEEE Journal of Solid-State Circuits, vol. 28, no. 12, pp. 1207–1215, 1993.
> 
> **[2]** E. Siragusa and I. Galton, “A Digitally Enhanced 1.8-V 15-bit 40-MSample/s CMOS Pipelined ADC,” IEEE Journal of Solid-State Circuits, vol. 39, no. 12, 2004.
> 
> **[3]** Y. Chiu, B. Nikolić, and P. R. Gray, “Least Mean Square Adaptive Digital Background Calibration of Pipelined Analog-to-Digital Converters,” IEEE Transactions on Circuits and Systems I: Regular Papers, 2004.
> 
> **[4]** J. A. McNeill, M. C. W. Coln, and B. J. Larivee, “Split ADC Architecture for Deterministic Digital Background Calibration of a 16-bit 1-MS/s ADC,” IEEE Transactions on Circuits and Systems I: Regular Papers, 2005.
> 
> **[5]** J. P. Keane et al., “Background Interstage Gain Calibration Technique for Pipelined ADCs,” IEEE Transactions on Circuits and Systems I: Regular Papers, vol. 52, pp. 32–43, 2005. DOI: 10.1109/TCSI.2004.839534.
> 
> **[6]** J. P. Keane, “Digital Background Calibration for Memory Effects in Pipelined Analog-to-Digital Converters,” IEEE Transactions on Circuits and Systems I, 2006.
> 
> **[7]** A. Panigada and I. Galton, “Digital Background Correction of Harmonic Distortion in Pipelined ADCs,” IEEE Transactions on Circuits and Systems I: Regular Papers, vol. 53, pp. 1885–1895, 2006. DOI: 10.1109/TCSI.2006.880034.
> 
> **[8]** Y.-S. Shu and B.-S. Song, “A 15-bit Linear 20-MS/s Pipelined ADC Digitally Calibrated With Signal-Dependent Dithering,” IEEE Journal of Solid-State Circuits, vol. 43, no. 2, pp. 342–350, 2008. DOI: 10.1109/JSSC.2007.914260.
> 
> **[9]** A. M. A. Ali et al., “A 16-bit 250-MS/s IF Sampling Pipelined ADC With Background Calibration,” IEEE Journal of Solid-State Circuits, vol. 45, no. 12, pp. 2602–2612, 2010.
> 
> **[10]** M. El-Chammas and B. Murmann, “A 12-GS/s 81-mW 5-bit Time-Interleaved Flash ADC with Background Timing Skew Calibration,” IEEE Journal of Solid-State Circuits, vol. 46, no. 4, pp. 838–847, 2011.
> 
> **[11]** N. Sun, “Exploiting Process Variation and Noise in Comparators to Calibrate Interstage Gain Nonlinearity in Pipelined ADCs,” IEEE Transactions on Circuits and Systems I: Regular Papers, vol. 59, pp. 685–694, 2012. DOI: 10.1109/TCSI.2011.2169854.
> 
> **[12]** A. M. A. Ali et al., “A 14 Bit 1 GS/s RF Sampling Pipelined ADC With Background Calibration,” IEEE Journal of Solid-State Circuits, vol. 49, no. 12, pp. 2857–2867, 2014. DOI: 10.1109/JSSC.2014.2361339.
> 
> **[13]** Y. Zhou, B. Xu, and Y. Chiu, “A 12 bit 160 MS/s Two-Step SAR ADC With Background Bit-Weight Calibration Using a Time-Domain Proximity Detector,” IEEE Journal of Solid-State Circuits, vol. 50, no. 4, pp. 920–931, 2015. DOI: 10.1109/JSSC.2014.2384025.
> 
> **[14]** A. M. A. Ali et al., “A 14-bit 2.5 GS/s and 5 GS/s RF Sampling ADC with Background Calibration and Dither,” in IEEE Symposium on VLSI Circuits, 2016. DOI: 10.1109/VLSIC.2016.7573537.
> 
> **[15]** J. Song, K. Ragab, X. Tang, and N. Sun, “A 10-b 800-MS/s Time-Interleaved SAR ADC With Fast Variance-Based Timing-Skew Calibration,” IEEE Journal of Solid-State Circuits, vol. 52, no. 10, pp. 2563–2575, 2017. DOI: 10.1109/JSSC.2017.2713523.
> 
> **[16]** C.-Y. Lin, Y.-H. Wei, and T.-C. Lee, “A 10-bit 2.6-GS/s Time-Interleaved SAR ADC With a Digital-Mixing Timing-Skew Calibration Technique,” IEEE Journal of Solid-State Circuits, vol. 53, no. 5, pp. 1508–1517, 2018. DOI: 10.1109/JSSC.2018.2793535.
> 
> **[17]** H.-W. Kang, H.-K. Hong, W. Kim, and S.-T. Ryu, “A Time-Interleaved 12-b 270-MS/s SAR ADC With Virtual-Timing-Reference Timing-Skew Calibration Scheme,” IEEE Journal of Solid-State Circuits, vol. 53, no. 9, pp. 2584–2594, 2018. DOI: 10.1109/JSSC.2018.2843360.
> 
> **[18]** P. Wang, N. Wu, F. Li, and Z. Wang, “Dither-based Background Calibration of Capacitor Mismatch and Inter-stage Gain Error in Pipelined Noise-Shaping SAR ADC,” Electronics Letters, 2019. DOI: 10.1049/el.2019.0872.
> 
> **[19]** J. Sun, X. Li, C. Yan, and W. Liu, “Dither-based Calibration of Bit Weights in Pipelined-SAR ADCs with Fast Convergence Speed Using Partially Split Structure,” Electronics Letters, 2020. DOI: 10.1049/el.2020.0579.
> 
> **[20]** J. Sun, X. Li, C. Yan, and W. Liu, “Background Calibration of Bit Weights in Pipeline ADCs Using a Counteracting Dither Technique,” Electronics Letters, 2020. DOI: 10.1049/el.2020.0006.
> 
> **[21]** L. Zhang, X. Li, C. Yan, and W. Liu, “Background Calibration Based on Signal-Dependent Dithering for Pipelined Successive Approximation Register ADCs Exploiting Noise Quantiser Technique,” Electronics Letters, 2020. DOI: 10.1049/el.2019.3321.
> 
> **[22]** J. Wu and J. Wu, “A 12-Bit 200 MS/s Pipelined-SAR ADC Using Back-Ground Calibration for Inter-Stage Gain,” Electronics, vol. 9, 507, 2020.
> 
> **[23]** C.-K. Hsu et al., “A Pipeline SAR ADC with Second-Order Interstage Gain Error Shaping,” IEEE Journal of Solid-State Circuits, vol. 55, pp. 1032–1043, 2020. DOI: 10.1109/JSSC.2019.2962140.
> 
> **[24]** A. M. A. Ali et al., “A 12-b 18-GS/s RF Sampling ADC With an Integrated Wideband Track-and-Hold Amplifier and Background Calibration,” IEEE Journal of Solid-State Circuits, vol. 55, no. 12, pp. 3210–3224, 2020. DOI: 10.1109/JSSC.2020.3023882.
> 
> **[25]** B. Ding, P. Miao, F. Li, and W. Gu, “A Digital Background Calibration Technique for Interstage Gain Nonlinearity in Pipelined ADCs,” IEICE Electronics Express, vol. 19, no. 4, 2022. DOI: 10.1587/elex.19.20210571.
> 
> **[26]** J. Wu, H. Xu, X. Cao, and T. Liu, “A 16-Bit 120 MS/s Pipelined ADC Using a Multi-Level Dither Technique,” Electronics, vol. 11, no. 23, 2022.
> 
> **[27]** Y. Tao, M. Gu, B. Chi, Y. Zhong, L. Jie, and N. Sun, “22.4 A 4.8GS/s 7-ENoB Time-Interleaved SAR ADC with Dither-Based Background Timing-Skew Calibration and Bit-Distribution-Based Background Ping-Pong Comparator Offset Calibration,” in 2024 IEEE International Solid-State Circuits Conference $ISSCC$, pp. 394–396. DOI: 10.1109/ISSCC49657.2024.10454299.
> 
> **[28]** B. Ding et al., “An Interstage Gain Calibration Technique for Pipelined ADCs Exploiting Complementary Dithering and Calibration Windows Detector,” IEICE Electronics Express, vol. 21, no. 8, 2024.
> 
> **[29]** Y. Cao, M. Zhang, Y. Zhu, et al., “A 12-GS/s 12-b 4× Time-Interleaved ADC Using Input-Independent Timing-Skew Calibration With Global Dither Injection and Linearized Input Buffer,” IEEE Journal of Solid-State Circuits, vol. 59, pp. 4211–4224, 2024. DOI: 10.1109/JSSC.2024.3482567.
> 
> **[30]** M. Gu, Y. Tao, X. He, Y. Zhong, L. Jie, and N. Sun, “A 1-GS/s 11-b Time-Interleaved SAR ADC With Robust, Fast, and Accurate Autocorrelation-Based Background Timing-Skew Calibration,” IEEE Journal of Solid-State Circuits, vol. 60, no. 2, pp. 421–431, 2025. DOI: 10.1109/JSSC.2024.3421363.
> 
> **[31]** P. Wang, N. Wu, F. Li, and Z. Wang, “A 1-GS/s 12-bit Pipelined-SAR ADC With Dither-Based Background Calibration of Interstage Gain and Comparator Offset in 28-nm CMOS,” IEEE Transactions on Circuits and Systems I: Regular Papers, early access, 2025. DOI: 10.1109/TCSI.2025.3620579.
> 
> **[32]** L. Chen, Y. Cao, L. Ling, S. Liu, and H. Han, “Metastable-Dither-Based Digital Background Calibration of Interstage Gain Nonlinearity in Pipelined SAR ADC,” IEEE Transactions on Very Large Scale Integration $VLSI$ Systems, vol. 33, no. 6, pp. 1794–1798, 2025.
> 
> **[33]** B. He, X. Guo, H. Jia, K. Sun, L. Zhou, Z. Chen, and X. Liu, “A Dither-Based Background Calibration Circuit for Pipelined ADCs in 40 nm CMOS,” IEICE Electronics Express, vol. 22, no. 5, 2025.
> 
> **[34]** S. Xu, S. Liang, J. Li, Z. Kang, D. Zhang, G. Wu, and L. Zhan, “Subtractive-Dither-Assisted Background Calibration for Linearity Enhancement in Pipelined ADCs for IIoT Applications,” Sensors, vol. 26, no. 5, 1632, 2026.
> 
> **[35]** A. M. A. Ali, “Calibration Techniques in ADCs,” ISSCC Tutorial, 2021. （教程资料，适合把握pipeline ADC数字辅助校准整体脉络）
> 
> **[36]** M. Gu, Y. Tao, Y. Zhong, L. Jie, and N. Sun, “Timing-Skew Calibration Techniques in Time-Interleaved ADCs,” IEEE Open Journal of the Solid-State Circuits Society, 2025. （综述资料，适合理解TI-ADC timing-skew路线图）


### 6.3 附录 A：读文献时建议重点追问的十个问题

第一，论文到底在校准什么。很多标题写的是“background calibration”，但具体对象可能是线性增益误差、位权误差、比较器失调、时间偏斜、增益非线性、memory effect，甚至只是把小信号失真打散。若不先把目标误差说清楚，很容易把两个本质不同的方法混为一谈。

第二，dither注入在哪里。是输入端、CDAC、MDAC、比较器阈值、输入缓冲，还是参考时钟？注入位置决定了可观测参数、模拟副作用、数字消除难度，也往往决定论文真正的创新落点。第三，数字端究竟提取了什么统计量。是相关、方差、自相关、窗口内码分布、决策时间还是亚稳态概率？同一类误差可以对应完全不同的统计量构造。

第四，输入干扰是怎样被抑制的。许多论文在公式上默认输入与dither独立，但在真实芯片中未必成立。要特别看作者有没有采用signal-dependent dithering、partially split structure、window detector、digital input-interference cancellation、global dither injection或多相时序隔离等措施。第五，dither本身是否需要精确匹配。若方案要求两路或多路dither幅值严格相等，那么版图失配和PVT漂移可能直接成为新误差源。

第六，校准是在前台、后台，还是伪后台。很多论文名义上说background，实际却需要特定训练序列、静止输入窗口或受限信号带宽。真正的后台校准应该在正常信号存在时持续工作，并能跟踪慢变化。第七，收敛速度如何定义。是按转换次数、采样时间、有效LMS迭代步，还是按达到某个SFDR/SNDR门限来统计？不同定义下的“快收敛”并不等价。

第八，论文有没有明确讨论dither带来的副作用，比如残差摆幅上升、后级饱和风险、动态范围损失、spur泄漏和额外噪底。第九，行为模型与晶体管实现之间是否闭环一致。若只有Matlab结果，没有考虑注入路径失配、时序偏差和电路噪声，往往距离真正可落地还很远。第十，作者有没有说明该方法为什么适合它所用的ADC结构。如果某方案高度依赖交替比较器、冗余码或特定CDAC拓扑，那么迁移到别的架构时并不一定成立。


### 6.4 附录 B：面向 Matlab / Verilog-A 联合仿真的实施建议

若你准备把dither校准真正做成可反复复用的研究平台，我建议按“从简到繁”的顺序推进，而不是一开始就把所有非理想同时放进去。第一步，先建立理想两级或多通道行为模型，确认在理想时序、理想dither副本和无输入干扰条件下，统计量与参数更新律是正确的。此时的目标不是看SNDR有多高，而是验证梯度方向、收敛点和参数敏感度。

第二步，只引入一种非理想并逐项扫描。对于pipelined-SAR，优先加入级间增益误差、比较器失调、电容失配和有限dither幅值失配；对于TI ADC，优先加入timing skew、offset mismatch、gain mismatch与注入路径不一致。每加一项都记录：校准量均值如何漂移、方差如何变大、步长上限如何变化、最终残余误差下限是否被抬高。这样你很容易分辨“算法本身失效”和“观测量被污染”到底哪一个是主要矛盾。

第三步，再引入时序细节。尤其是交替比较器、分时注入、ping-pong路径和多相时钟系统，必须把注入相位、更新时刻、统计窗口长度和数字延迟完整建出来。很多看似神秘的仿真异常，其实只是dither副本与真正起作用的模拟扰动错了半个时钟或一个子相位。第四步，在Verilog-A中尽量采用简单稳定的更新律，例如滑动平均、相关积分、sign-LMS或低位宽LMS。复杂算法固然更“先进”，但在AMS联合仿真里往往因为数值震荡、量化边界和事件调度问题而难以稳定。

第五步，别忽略观测窗口长度本身就是设计参数。窗口太短，统计量噪声大，更新会抖动；窗口太长，跟踪PVT的能力又会变差。因此，建议你把“窗口长度—步长—dither幅值”作为一个三维设计空间联合扫一遍，再去比较不同校准框图，而不要只固定一个窗口长度得出结论。最后，最好在模型中加入一个可切换的数字干扰抵消模块。因为很多文献真正的改进点，不是更高明的LMS，而是更干净的误差观测量。只要把这一步单独抽象出来，你后续阅读任何新论文时，都能非常快地判断它究竟改进了哪里。


### 6.5 附录 C：阅读与建模这类文献时最容易犯的误区

误区一：把 dither 仅仅理解为“加噪声”。实际上，校准用 dither 的价值不在于噪声本身，而在于它是否能够在被估计参数与输出误差之间建立可观测、可相关、可平均的统计通道。真正需要关注的是注入位置、符号对称性、与主信号的独立性、以及数字后处理是否能够把 dither 分量从主路径中正确扣除。

误区二：只看最终频谱改善，而忽略收敛过程。很多论文在结果部分只展示校准前后 SNDR、SFDR 或 spur 变化，但对研究者而言，更关键的是收敛速度、稳态抖动、步长敏感性、输入幅度依赖性，以及当输入从单音切换到宽带、多音或低幅度场景时算法是否仍然稳定。没有这些信息，就很难判断方法是否适合真实后台运行。

误区三：默认认为所有失配都能用同一种 dither+LMS 框架解决。事实上，不同误差的可观测性完全不同。电容失配通常体现在位权偏差；级间增益误差体现为 residue slope 偏差；比较器相对失调往往要借助翻转、轮换或交替比较器结构；time-skew 则本质上与输入时间导数相关。虽然都能写成“相关提取”，但注入对象、误差通道、解耦难度与实现成本差异很大。

误区四：忽略模拟电路对理想统计模型的破坏。论文中的 PN 序列常被当作理想独立随机变量，但在真实芯片中，dither DAC 的失配、参考缓冲有限驱动、开关注入、比较器 kickback、时钟占空比误差、版图耦合等都会让注入量偏离理想模型。于是理论上的零均值、对称分布、独立性，在电路中可能并不严格成立，这也是很多论文后来转向 complementary dither、counteracting dither、global dither injection 的根本原因。

误区五：只在大信号单音下验证。真正优秀的后台校准，应该对输入统计特性尽量不敏感，至少不能只在“接近满幅、正弦稳态”条件下成立。研究时应系统扫描输入频率、幅度、调制方式和带宽：例如小信号、近直流、近奈奎斯特、多音、带外阻塞、甚至输入幅度变化过程。只有这样，才能看出算法究竟是“论文有效”，还是“系统可用”。

误区六：把补偿码更新看成纯数字问题。实际上，更新路径与主转换路径之间存在延迟、量化、截断与同步关系。特别是在 pipelined-SAR 或 TI-SAR 结构中，若校准码生效的时刻与当前采样输出没有严格对齐，就会引入额外偏差，甚至在收敛后形成周期性 spur。因此在 Matlab 行为模型中，必须显式建模延迟线、通道配对关系、码字对齐、以及背景更新的时序粒度。

误区七：用过大的步长追求快速收敛。LMS 或 sign-LMS 的步长不仅决定收敛快慢，也决定稳态噪声和误差底限。步长过大虽然前期看起来收敛很快，但容易在稳态产生抖动，甚至与输入频谱相互调制造成新 spur。更合理的做法通常是两阶段策略：先用较大步长粗收敛，再切换到较小步长稳态跟踪；或者在误差统计量足够可信时才允许更新。

误区八：没有把“能否数字扣除 dither”作为架构筛选条件。很多方案提出了一种注入方式，但并未充分讨论其数字可逆性。若 dither 注入后既影响主量化路径，又无法以已知符号和已知权重准确重构，那么它虽然可能帮助相关提取，却会永久降低动态范围或引入残余杂散。评价一个 dither 方案时，必须同时检查‘可观测性’与‘可消除性’，缺一不可。

误区九：忽略论文之间问题定义的差异。有些论文校准的是整体 interstage gain error，有些针对 gain nonlinearity，有些只处理某些关键 bit-weight，有些则联合校准 offset、gain 与 timing skew。若不先统一“误差模型”，很容易把不同论文的结果直接横向比较，得出错误结论。写综述时最好先建立统一框架：误差对象—注入位置—提取统计量—更新律—数字扣除方式—适用输入条件，再逐篇归类。

误区十：只停留在读论文层面，不做最小可复现实验。对你当前的研究方向，最有价值的做法不是一次性搭很复杂的晶体管级系统，而是先做三层模型：第一层是理想统计模型，用于验证相关性与收敛；第二层是含量化、失配、延迟和有限位宽的行为模型；第三层再把关键模拟非理想逐项注入。这样能迅速判断某篇论文的核心思想究竟是数学上可行、工程上可行，还是仅在特定假设下成立。


## 相关笔记

- [CLS 技术：原理、变种与设计](/GarveyDing_AcademicPages/blog/correlated-level-shifting/)
- [ADC 架构：分类、比较与选型](/GarveyDing_AcademicPages/blog/adc-architectures/)
