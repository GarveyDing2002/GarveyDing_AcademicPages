---
title: ADC 架构：分类、比较与选型
date: '2026-10-26'
excerpt: 从采样机制、速度、精度、功耗和应用场景对 ADC 架构进行分类、比较与选型。
tags:
- 学习记录
- adc
- architecture
---

# ADC 架构：分类、比较与选型

> [!abstract] 核心定位
> 从采样机制、速度、精度、功耗和应用场景对 ADC 架构进行分类、比较与选型。

---

## 目录

- **2026 新增专题**：见文末扩展篇章，含新增推导、文献与配图

1. 架构分类与总体框架
   - 1.1 架构速览
   - 1.2 ADC 类型综合分类主表
2. 架构选型与发展趋势
   - 2.1 快速选型总结
   - 2.2 现代 ADC 架构发展趋势
3. 高速混合 ADC 与研究方向
   - 3.1 与高速 Pipeline-SAR / SAR+TD 方向的关系
4. 总结
   - 4.1 一句话总结

## 1. 架构分类与总体框架

![01_adc_architecture_map](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-architectures/01_adc_architecture_map.svg)

*图：ADC 架构选择应同时考虑速度、精度、功耗和输入场景。*

### 1.1 架构速览

- Nyquist ADC

    - Flash ADC

    - Folded interpolation ADC

    - SAR ADC

    - Pipeline ADC

    - Time-Interleaved ADC

    - Single Slope ADC

- Over-Sampling ADC

    - Sigma-Delta ADC

- Time-Domain ADC

    - VTC-TDC ADC

- Continuous-Time ADC

    - CT Pipeline ADC

    - CT Sigma-Delta ADC

- Hybrid ADC

    - Pipeline-SAR ADC

    - Noise-Shaping SAR ADC

    - Zoom ADC

> 说明：ADC 架构之间并不是完全互斥的。现代高性能 ADC 往往是混合架构，例如 Pipeline-SAR、Flash-SAR、SAR+TD、VCO-assisted NS-SAR、Time-Interleaved Pipeline-SAR 等。 本表按“转换原理、系统组织、混合架构、应用形态、采样方式、信号域”等维度综合整理，适合做文献调研、架构选型和论文综述时使用。

### 1.2 ADC 类型综合分类主表

|分类维度|ADC 类型|大类/本质|核心原理|典型分辨率|典型速度/带宽|关键电路模块|主要优点|主要缺点|主要误差/设计难点|常见校准/补偿|典型应用|
|---|---|---|---|---|---|---|---|---|---|---|---|
|按转换原理|Flash ADC / 闪速 ADC|直接比较型|用 $2^N-1$ 个比较器同时比较输入与所有参考阈值，输出温度计码后编码|低到中，常见 4–8 bit，少数可到 10 bit|最高，可达 GS/s 到数十 GS/s|比较器阵列、参考电阻梯/电容梯、前置放大器、bubble correction、thermometer-to-binary encoder|速度极快，转换延迟最低，结构直观|比较器数量指数增长，输入电容大，功耗和面积大，失调严重，参考梯负载大|比较器 offset、bubble error、参考梯误差、输入带宽、kickback、热噪声|offset 校准、参考梯校准、bubble correction、插值/平均降低 offset|超高速示波器、SerDes、PAM 接收机、RF/IF 粗量化器、高速混合 ADC 前端|
|按转换原理|Folding ADC / 折叠 ADC|直接比较 + 模拟预处理|先用折叠放大器把输入范围折叠成周期性波形，再用较少比较器量化|6–10 bit 常见|高，数百 MS/s 到数 GS/s|folding amplifier、coarse ADC、fine ADC、插值网络、编码逻辑|比全 Flash 少很多比较器，速度仍然较高|折叠放大器线性度、带宽和匹配要求高；设计复杂；现代先进工艺中纯折叠结构减少|folding 增益误差、零交越点误差、插值误差、bubble error、失调|前放 offset 校准、数字纠错、插值误差补偿|早期高速视频 ADC、IF ADC、通信 ADC|
|按转换原理|Folding-Interpolating ADC / 折叠内插 ADC|折叠 + 内插|在折叠 ADC 基础上通过内插产生更多等效比较阈值，进一步减少前端放大器和比较器数量|6–10 bit|高|folding cell、resistive/capacitive interpolation、comparator bank、bubble correction|速度高，比较器数量低于 Flash，面积和功耗较 Flash 好|模拟前端复杂，内插线性度和带宽困难，PVT 敏感|内插权重误差、前放 offset、折叠边界误差|offset averaging、数字 bubble correction、参考/内插校准|早期高速中低精度 ADC，视频、宽带通信|
|按转换原理|SAR ADC / 逐次逼近 ADC|二分搜索|用 DAC 逐位逼近输入，每次比较确定一位，从 MSB 到 LSB 完成转换|8–18 bit 常见|kS/s 到数百 MS/s；高速设计可到 GS/s 级|CDAC、比较器、SAR logic、参考缓冲、采样开关|低功耗、面积小、数字友好、无静态功耗，适合先进 CMOS|速度受比较次数、DAC settling、比较器延迟和逻辑延迟限制；高精度时 CDAC 面积大|kT/C 噪声、CDAC mismatch、比较器噪声/失调、参考 settling、采样非线性|CDAC mismatch 校准、比较器 offset 校准、冗余位、数字误差修正|MCU、传感器、医疗、工业控制、数据采集、SoC ADC|
|按转换原理|Charge-Redistribution SAR / 电容重分配 SAR|电荷域 SAR|采样到电容阵列后通过电荷重分配产生 DAC 电压，比较器逐位判决|8–16 bit 常见|MS/s 到数百 MS/s|二进制 CDAC、split CDAC、bridge capacitor、bottom-plate sampling、bootstrapped switch|功耗低，电容匹配好，结构成熟|高分辨率时电容阵列面积大，寄生敏感，参考驱动压力大|CDAC mismatch、bridge cap 误差、寄生电容、switch nonlinearity、reference ripple|电容校准、split DAC 校正、冗余、foreground/background calibration|通用 SAR ADC，低功耗中高精度 ADC|
|按转换原理|Asynchronous SAR / 异步 SAR|自定时逐次逼近|比较器完成一位判决后立即触发下一位，不用固定周期高速全局时钟逐位控制|6–12 bit 常见，高速场景多|高，可达数百 MS/s 到 GS/s|动态比较器、EOC 检测、自定时逻辑、异步控制链|速度快，自动适配每一位比较时间，降低全局时钟压力|时序验证复杂，metastability 和完成检测设计困难|比较器完成检测错误、亚稳态、异步逻辑毛刺、DAC 未完全 settling|冗余位、metastability 检测、异步时序 margin 设计|高速 SAR、Pipeline-SAR 子 ADC、低功耗高速 ADC|
|按转换原理|Multi-bit-per-cycle SAR / 多位每周期 SAR|并行比较 + SAR 搜索|每个 SAR 周期用多个比较器或小 Flash 同时决定 2 bit 或更多|6–12 bit|高于普通 SAR|multi-comparator array、小 Flash、multi-level DAC、复杂 SAR logic|减少比较周期，提升速度|比较器数量增加，参考阈值复杂，失调和编码更复杂|多比较器 offset、阈值失配、bubble error、DAC settling|offset 校准、冗余判决、数字纠错|高速 SAR、wireline 接收机、混合 ADC 细量化/粗量化|
|按转换原理|Flash-assisted SAR / Flash 辅助 SAR|粗 Flash + SAR 细搜索|先用小 Flash 得到高几位或搜索区间，再用 SAR 完成剩余位|8–12 bit|高|coarse Flash、SAR CDAC、数字拼接/纠错|比纯 SAR 快，比全 Flash 省功耗|粗细级匹配和冗余设计复杂，Flash offset 影响大|coarse/fine boundary error、Flash offset、CDAC mismatch|冗余范围设计、Flash offset 校准、digital correction|高速中精度 ADC、通信 ADC|
|按转换原理|Noise-Shaping SAR / 噪声整形 SAR|SAR + 误差反馈|保留 SAR 主量化，同时把量化误差通过模拟/无源/有源反馈积分并推到带外|10–18 bit 等效分辨率|中低到中速，取决于 OSR 和环路阶数|SAR CDAC、残差采样电容、loop filter、error-feedback path、数字滤波器|比传统 ΔΣ 更低功耗，比普通 SAR 更高动态范围|环路稳定性、残差传递、噪声泄漏和寄生敏感|噪声转移函数 NTF、残差增益误差、有限增益、kT/C、比较器噪声|误差反馈系数校准、DAC mismatch 校准、数字滤波|音频、传感器、低功耗高精度 SoC、高动态范围数据采集|
|按转换原理|Subranging SAR / 子区间 SAR|粗细两步 SAR|先用粗 SAR 定位区间，再在该区间内用细 SAR 或局部 DAC 完成量化|8–14 bit|中高|coarse SAR、fine SAR、residue generation、range selection|减少 DAC 尺寸和转换时间|粗细级接口误差、范围切换误差、冗余要求高|粗级失调、局部 DAC mismatch、余差范围溢出|冗余位、数字校正、级间增益/offset 校准|中高速低功耗 ADC|
|按转换原理|Pipeline ADC / 传统流水线 ADC|多级粗细量化|每一级完成若干 bit 量化、DAC 回放、相减、余差放大，再传递给下一级|8–16 bit|高，数十 MS/s 到数 GS/s|Sub-ADC、Sub-DAC、MDAC、residue amplifier、digital correction|高速中高精度，吞吐率高，架构成熟|有流水线延迟，功耗较高，依赖高性能放大器|MDAC settling、运放有限增益、级间增益误差、DAC mismatch、比较器 offset|数字纠错、冗余、运放增益校准、DAC mismatch 校准|通信、雷达、仪器、宽带数据采集|
|按转换原理|MDAC-based Pipeline ADC|开关电容余差放大|用 MDAC 同时实现 DAC 回放、减法和残差放大|10–16 bit|中高到高|SC MDAC、OTA、采样/反馈电容、Sub-ADC、Sub-DAC|精度高，理论成熟，适合中高精度|OTA 增益/带宽/摆幅要求高，先进低压工艺困难|有限增益、settling error、slew、thermal noise、capacitor mismatch|foreground/background gain calibration、opamp sharing、digital correction|高性能仪器、通信 ADC、传统高速 ADC|
|按转换原理|Open-loop Pipeline ADC|开环余差放大|用开环放大器代替闭环 OTA，提高速度和能效，依赖校准修正增益误差|8–12 bit 常见|高|open-loop amplifier、gain calibration、residue ADC|速度快，功耗低，无闭环稳定性限制|增益精度和线性度差，PVT 敏感|开环增益误差、非线性、温漂、输入/输出摆幅限制|后台增益校准、非线性校准、查找表 LUT|先进 CMOS 高速 Pipeline/Pipeline-SAR|
|按转换原理|Ring-Amplifier Pipeline ADC|动态闭环/类反相器放大|用 ring amplifier 提供高 slew、高效率的动态余差放大|10–14 bit 常见|中高到高|ring amplifier、SC MDAC、稳定性控制、bias/自偏置|比传统 OTA 能效高，适合低电压|稳定性、PVT、输出共模和线性度设计复杂|settling、稳定性、ringamp dead-zone、非线性|增益校准、共模校准、数字背景校准|高速中高精度 Pipeline、Pipeline-SAR|
|按转换原理|Dynamic-Amplifier Pipeline ADC|动态余差放大|用无静态电流的动态放大器对余差进行有限时间放大|8–12 bit 常见|高|dynamic amplifier、gain control、sampling network、calibration logic|低功耗，高速，先进工艺友好|增益随 PVT 和输入变化，精度依赖校准|增益误差、非线性、噪声、输出共模漂移|增益校准、非线性校准、参考/偏置自适应|低功耗高速 Pipeline-SAR|
|按转换原理|FIA Pipeline ADC / Floating Inverter Amplifier|浮动反相器动态放大|利用浮动供电/动态偏置反相器进行高能效余差放大|8–12 bit 常见|中高到高|floating inverter amplifier、SC network、charge reservoir、CM control|能效高，适合先进低压工艺|增益、共模、线性度和时序敏感|PVT 增益变化、输出共模、残余电荷误差|增益校准、CMFB/动态共模控制、数字校准|高速低功耗 Pipeline-SAR|
|按转换原理|CDRA Pipeline ADC / Charge-Domain Residue Amplifier|电荷域余差放大|在电荷域通过电容比和电荷共享实现余差放大或等效放大|8–12 bit 常见|高|电荷共享网络、开关电容阵列、动态比较器、gain calibration|低电压友好，输出摆幅可较低，速度高|电荷注入、寄生、电容比误差影响明显|寄生电容、开关电荷注入、电容 mismatch、增益误差|电容校准、增益校准、版图匹配优化|先进工艺高速低功耗 Pipeline-SAR|
|按转换原理|Pipeline-SAR ADC|流水线 + SAR 子级|每一级用 SAR 完成子量化，通过余差放大衔接多级|10–14 bit 常见|数百 MS/s 到数 GS/s|Stage-1 SAR、residue amplifier、Stage-2 SAR、冗余位、数字校准|比传统 Pipeline 低功耗，比单级 SAR 高速，现代高速 ADC 重要方向|级间增益、余差放大、时序、校准复杂|级间增益误差、CDAC mismatch、比较器噪声/offset、残差非线性|PN/LMS 背景校准、增益校准、冗余修正、CDAC 校准|通信、雷达、仪器、宽带 SoC、高速中高精度 ADC|
|按转换原理|Two-Step ADC / 两步式 ADC|粗细两步量化|第一步粗量化确定大区间，第二步对余差或子区间做细量化|6–14 bit|中高到高|coarse ADC、DAC、residue amplifier/fine ADC、digital correction|比全 Flash 省功耗，比纯 SAR 快，结构灵活|粗细级误差、冗余、拼接复杂|coarse offset、DAC mismatch、级间增益误差、余差溢出|冗余位、数字纠错、增益/offset 校准|高速中精度 ADC、图像传感器、通信|
|按转换原理|Subranging ADC / 子量程 ADC|粗量程选择 + 细量化|粗 ADC 选择输入所在区间，细 ADC 在该子量程内细分|6–12 bit|中高|coarse ADC、range DAC、fine ADC、range correction|减少比较器数量和 DAC 尺寸|区间边界误差敏感，需要冗余|coarse/fine mismatch、边界失调、参考误差|overlap redundancy、digital correction|高速 ADC、图像传感器列 ADC|
|按转换原理|Cyclic ADC / 循环 ADC|时间复用流水线|重复使用同一个乘二余差放大/比较/DAC 单元，每周期产生一位或多位|10–16 bit|低到中|MDAC、比较器、寄存器、循环控制逻辑|面积小，功耗适中，精度可较高|速度慢于 Pipeline，放大器误差会累积|增益误差、settling、DAC mismatch、比较器 offset|数字校正、冗余、增益校准|面积受限仪器、传感器、高精度中低速 ADC|
|按转换原理|Algorithmic ADC / 算法型 ADC|迭代余差运算|通过重复算法步骤逐位或逐组位产生输出码，与 cyclic ADC 接近|10–16 bit|低到中|sample/hold、gain-of-two amplifier、DAC/comparator、control logic|结构简单，面积小|速度有限，对放大器精度依赖强|有限增益、offset、噪声累积|增益校准、offset cancellation|精密中低速转换、嵌入式 ADC|
|按转换原理|Single-Slope ADC / 单斜率 ADC|电压-时间转换|用线性 ramp 与输入比较，计数 ramp 达到输入所需时间|8–14 bit 常见|低，转换时间约随 $2^N$ 增长|ramp generator、comparator、counter、latch|结构极简单，列并行面积小，匹配要求相对低|速度慢，ramp 线性度和计数时钟影响精度|ramp 非线性、比较器 offset、时钟 jitter、噪声|ramp 校准、CDS、offset cancellation|CMOS 图像传感器列 ADC、低速传感器|
|按转换原理|Dual-Slope ADC / 双斜率 ADC|积分型|先固定时间积分输入，再用参考反向积分，回零时间对应输入大小|12–24 bit|很低|积分器、比较器、参考源、计数器、控制逻辑|抗工频噪声强，对 RC 和时钟绝对值不敏感，线性度高|速度很慢，不适合宽带信号|积分器 leakage、运放 offset、参考噪声、开关注入|auto-zero、chopper、参考校准|数字万用表、精密仪器、工业计量|
|按转换原理|Multi-Slope ADC / 多斜率 ADC|多参考积分|使用多个参考电流/电压斜率加速积分型转换并提高分辨率|16–24 bit 或更高|低|积分器、多参考 DAC/电流源、比较器、计数器|极高精度，抗噪声强，比双斜率更灵活|控制复杂，速度仍有限|参考切换误差、积分器非理想、温漂|参考校准、auto-zero、数字线性化|高端 DMM、精密计量|
|按转换原理|Wilkinson ADC|斜坡计时|采样保持后与 ramp 比较，计数得到输入对应时间|8–14 bit|低到中，视并行度而定|ramp、comparator、counter、sample/hold|结构简单，适合多通道并行|转换时间长，ramp 质量关键|ramp 非线性、比较器 offset、计数器 jitter|ramp 校准、offset cancellation|粒子探测读出、图像传感器、时间测量系统|
|按转换原理|Delta-Sigma ADC / ΔΣ ADC|过采样 + 噪声整形|高频过采样，反馈环路把量化噪声推到带外，再数字滤波抽取|16–24 bit 常见|低到中，带宽从 Hz 到 MHz 级，部分宽带可更高|loop filter、quantizer、feedback DAC、decimation filter|高分辨率、低噪声、数字滤波能力强|延迟大，带宽受 OSR 限制，环路稳定性复杂|环路稳定性、DAC mismatch、jitter、运放噪声、idle tone|DEM、DWA、chopper、digital filter、MASH、系数校准|音频、精密传感、工业测量、医疗、宽动态范围采集|
|按转换原理|Discrete-Time ΔΣ ADC / 离散时间 ΔΣ|开关电容环路滤波|用开关电容积分器实现离散时间噪声整形|16–24 bit|低到中|SC integrator、multi-bit quantizer、feedback DAC、clocked switches|系数精度高，理论建模清晰|高速下运放 settling 和开关驱动功耗大|finite gain/bandwidth、kT/C、DAC mismatch、clock feedthrough|DEM、chopper、opamp gain calibration、数字滤波|音频、传感器、精密测量|
|按转换原理|Continuous-Time ΔΣ ADC / CTSD|连续时间环路滤波|输入在连续时间滤波器中处理，量化器处采样，反馈 DAC 连续时间作用|12–20 bit|中等到较高带宽，kHz 到几十/数百 MHz 级|Gm-C/RC loop filter、quantizer、feedback DAC、ELD compensation|输入易驱动，自带一定抗混叠能力，适合宽带高动态范围|对时钟 jitter、反馈 DAC 波形、excess loop delay 敏感|ELD、DAC pulse shape、jitter、环路稳定性、RC/Gm 变化|系数校准、ELD compensation、DAC mismatch DEM、时钟优化|音频、通信、宽带接收机、高动态范围 ADC|
|按转换原理|Bandpass ΔΣ ADC / 带通 ΔΣ|带通噪声整形|把量化噪声从目标中频/窄带频段移开，而非只围绕 DC 整形|10–18 bit|窄带中频/射频应用|bandpass loop filter、resonator、quantizer、feedback DAC|适合 IF 直接数字化，目标带内高动态范围|中心频率和 Q 值敏感，设计复杂|谐振器误差、clock jitter、DAC mismatch、稳定性|中心频率校准、DEM、数字下变频配合|无线接收机、IF ADC、窄带通信|
|按转换原理|Incremental ΔΣ ADC / 增量式 ΔΣ|有限周期 ΔΣ|每次转换前 reset 调制器，在固定周期内完成一个 Nyquist-like 输出|14–24 bit|低速|resettable loop filter、quantizer、sinc/FIR filter、MUX-friendly front-end|高精度，适合多路复用，延迟可控|转换时间较长，不适合高速连续宽带信号|reset 误差、积分器噪声、参考噪声、通道切换误差|auto-zero、chopper、数字滤波优化|传感器、医疗、生物电、工业多通道采集|
|按转换原理|MASH ΔΣ ADC|多级噪声整形|多个低阶 ΔΣ 级联，数字域消除前级量化噪声，获得高阶 NTF|12–24 bit|低到中|多个 modulator、数字噪声抵消滤波器、feedback DAC|高阶整形稳定性好于单环高阶|级间匹配误差会造成噪声泄漏|模拟/数字传递函数 mismatch、DAC nonlinearity、leakage|数字系数校准、级间增益校准、DEM|音频、通信、精密 ADC|
|按转换原理|VTC+TDC ADC / 电压-时间 ADC|电压转时间 + 时间量化|用 VTC 把输入电压差转换为时间差，再用 TDC 量化时间差|4–10 bit 常见；混合后可更高|高，适合高速低中精度|VTC、TDC、delay line、Vernier line、edge detector、encoder|先进 CMOS 友好，低电压下有优势，可减少电压域高增益需求|VTC 线性度、TDC bin mismatch、PVT、jitter 敏感|VTC gain/offset、TDC DNL/INL、delay PVT、clock jitter、metastability|VTC gain 校准、TDC bin 校准、DLL/PLL 校准、背景校准|SAR+TD 细量化、wireline receiver、高速混合 ADC、先进节点 ADC|
|按转换原理|Flash TDC ADC / 抽头延迟线 TDC ADC|delay-line 时间量化|把输入边沿送入抽头延迟线，用锁存器采样边沿位置得到温度计码|时间细量化 3–8 bit 常见|高|delay line、DFF array、thermometer encoder、bubble correction|结构简单，速度快|分辨率受单个 delay cell 限制，PVT 敏感|delay mismatch、bubble、metastability、jitter|bin calibration、bubble correction、DLL stabilization|TDC 后端、TD ADC、PLL/DLL 测量|
|按转换原理|Vernier TDC ADC|游标时间量化|用两条延迟略有差异的 delay line，分辨率为两者单元延迟之差|时间细量化高，ps 级甚至亚 ps 级|中到高，速度低于简单 flash TDC|双 delay line、arbiter/DFF、encoder、calibration|时间分辨率高，适合小时间差测量|转换时间可能较长，面积和功耗增加，PVT 敏感|两条 delay line mismatch、温漂、量化非均匀、死区|DLL/PLL 校准、bin-by-bin calibration、背景 tracking|高精度 TDC、SAR+TD 后端、ToF、PLL 测量|
|按转换原理|SAR TDC|时间域逐次逼近|类似 SAR ADC，用可调延迟 DAC 逐次逼近输入时间差|中高时间分辨率|中等|time DAC、arbiter、SAR logic、delay calibration|面积低于 flash TDC，分辨率可较高|转换周期多，延迟 DAC 匹配要求高|delay DAC mismatch、arbiter offset、PVT drift|delay calibration、冗余、背景校准|时间测量、TD ADC、数字 PLL|
|按转换原理|Pipelined TDC / 流水线 TDC|时间余差流水线|每级解析一部分时间差并产生时间残差给下一级|高|高吞吐场景|time amplifier、time subtractor、TDC stage、digital correction|高吞吐，高分辨率潜力|时间放大器和时间残差处理复杂|time gain error、time offset、jitter、stage mismatch|时间增益校准、冗余纠错、bin 校准|高速 TD ADC、数字 PLL、时间测量|
|按转换原理|VCO-based ADC|电压-频率/相位转换|输入控制 VCO 频率或相位，通过计数/相位采样得到数字输出|8–16 bit 等效，取决于噪声整形和校准|中到高|ring VCO、counter、phase sampler、digital differentiator、feedback path|数字友好，先进 CMOS 受益，天然有噪声整形潜力|KVCO 非线性、相位噪声、PVT 敏感|VCO 非线性、jitter、phase noise、gain drift、mismatch|KVCO 校准、DEM、反馈线性化、数字非线性补偿|先进工艺 ADC、传感器、通信、VCO-assisted NS ADC|
|按转换原理|Open-loop VCO ADC|开环 V-F 转换|直接用输入控制 VCO，计数或测相位得到输出|中低到中|中高|VCO、counter/edge detector、digital filter|结构简单，数字友好|线性度差，强依赖 VCO 特性|KVCO 非线性、PVT、相位噪声|查找表校准、前端线性化、数字补偿|低功耗传感器、粗量化、实验性先进 ADC|
|按转换原理|Feedback VCO ADC / VCO ΔΣ ADC|反馈线性化 + 噪声整形|把 VCO 放入反馈环路或 ΔΣ 环路中，改善线性度并整形噪声|10–16 bit 等效|中等|VCO quantizer、feedback DAC、loop filter、digital filter|比开环 VCO 线性度好，有噪声整形优势|环路稳定性和 DAC 误差复杂|反馈 DAC mismatch、VCO jitter、环路延迟|DEM、loop calibration、digital correction|低功耗高动态范围 ADC、先进节点 ADC|
|按转换原理|PWM ADC / 脉宽 ADC|电压-脉宽转换|输入电压调制脉冲宽度，再用计数器/TDC 测量脉宽|中低|低到中|ramp/comparator、PWM generator、counter/TDC|结构简单，适合低功耗|线性度和时钟精度受限，速度有限|ramp 线性度、comparator offset、jitter|ramp 校准、offset cancellation|传感器、IoT、生物医疗、嵌入式测量|
|按转换原理|PFM ADC / 脉冲频率 ADC|电压-频率转换|输入控制脉冲频率，在固定窗口内计数得到数字码|中低|低|V-F converter、counter、digital filter|结构简单，天然适合低频信号|响应慢，线性度和温漂问题明显|V-F 非线性、温漂、jitter、计数窗口误差|频率校准、温漂补偿、数字滤波|低功耗传感器、慢速物理量测量|
|按系统组织|Time-Interleaved ADC / 时间交织 ADC|多通道并行采样|M 个子 ADC 交替采样，总采样率为单通道采样率的 M 倍|取决于子 ADC，常见 6–14 bit|极高，GS/s 到数十/上百 GS/s|采样时钟分配、多个 sub-ADC、MUX/DEMUX、数字校准|显著提高总采样率，降低单通道速度压力|通道间 mismatch 产生 spur，时钟分配复杂|offset/gain/skew/bandwidth mismatch、通道参考误差|offset/gain/skew/background calibration、盲校准、自适应滤波|高速示波器、RF sampling、通信、雷达、数据中心互连|
|按系统组织|TI-SAR ADC|时间交织 + SAR|多个 SAR 通道交替采样实现高速转换|8–12 bit 常见|GS/s 级|SAR sub-ADC、采样网络、clock skew calibration、digital backend|低功耗高速，SAR 子通道易复制|高频输入下 timing skew 严重，通道带宽一致性难|skew、gain/offset mismatch、sampling switch nonlinearity|skew calibration、gain/offset calibration、通道随机化|高速低功耗 ADC、宽带接收机|
|按系统组织|TI-Pipeline ADC|时间交织 + Pipeline|多个 Pipeline 通道并行交替采样|8–16 bit|高到极高|Pipeline sub-ADC、clock tree、background calibration|高速中高精度能力强|功耗面积大，通道 mismatch 校准复杂|通道间 offset/gain/skew/bandwidth mismatch、MDAC mismatch|多维 mismatch 校准、数字滤波均衡|高端仪器、RF sampling ADC|
|按系统组织|TI-Pipeline-SAR ADC|时间交织 + Pipeline-SAR|多个 Pipeline-SAR 子通道交替工作，兼顾速度和能效|10–14 bit|GS/s 级|Pipeline-SAR sub-ADC、residue amplifier、interleaving calibration|现代高速中高精度高能效方向|子通道内部校准和通道间校准同时存在|级间增益误差 + 通道 mismatch + skew|PN/LMS 增益校准、通道 skew/gain/offset 校准|通信、雷达、宽带仪器、先进 SoC|
|按混合架构|Flash-SAR ADC|Flash 粗量化 + SAR 细量化|用 Flash 快速确定高位或区间，再由 SAR 完成低位|8–12 bit|高|Flash、SAR CDAC、数字拼接、冗余纠错|速度/功耗折中好|Flash offset 和 SAR 细级匹配复杂|coarse/fine mismatch、Flash offset、CDAC mismatch|冗余区间、offset 校准、数字纠错|高速中精度 ADC、wireline/通信 ADC|
|按混合架构|SAR-SAR Two-step ADC|两级 SAR|粗 SAR 量化后生成余差，细 SAR 继续量化|10–14 bit|中高|coarse SAR、residue amplifier或 passive residue、fine SAR|功耗低，结构规整，数字友好|级间增益和余差放大仍是瓶颈|级间增益误差、CDAC mismatch、余差溢出|级间增益校准、冗余、CDAC 校准|Pipeline-SAR、低功耗中高速 ADC|
|按混合架构|SAR+TD ADC|电压域粗量化 + 时间域细量化|SAR 先量化高位，余差经 VTC 转为时间差，再由 TDC 量化低位|6–12 bit；作为子级常见 5+3、4+4、5+4 等|高|SAR CDAC、VTC、TDC、sign/thermometer encoder、权重拼接|减少 SAR 比较次数，利用先进工艺时间分辨率，适合高速后端|VTC/TDC 权重匹配和校准复杂，jitter 敏感|VTC gain/offset、TDC DNL、time-voltage 权重不匹配、PVT|VTC gain 校准、TDC bin 校准、冗余编码、数字拼接校准|高速 Pipeline-SAR 第二级、wireline ADC、先进 CMOS 混合域 ADC|
|按混合架构|Pipeline + TD ADC|流水线前端 + 时间域后端|前级电压域粗量化和余差处理，后级用 VTC/TDC 做细量化|8–12 bit|高|Pipeline stage、VTC、TDC、digital correction|降低后端电压域精密比较压力，速度潜力高|跨域增益匹配、时序、校准复杂|interstage gain、VTC gain、TDC bin、jitter|跨域权重校准、背景校准|高速通信 ADC、先进节点 ADC|
|按混合架构|VCO-assisted SAR / NS-SAR|SAR + VCO 残差/噪声整形|SAR 完成主量化，VCO 对残差或量化噪声进行时间/相位域整形|10–16 bit 等效|中速|SAR、VCO、residue path、digital filter|兼具 SAR 能效和 VCO/噪声整形优势|系统复杂，VCO 非线性和残差路径匹配困难|VCO gain、residue scaling、noise leakage、jitter|VCO gain 校准、残差路径校准、数字滤波|低功耗高动态范围 ADC、先进工艺传感器/通信|
|按混合架构|Zoom ADC|粗 ADC + 高精度细 ADC|粗 ADC 先缩小输入范围，细 ΔΣ 或精密 ADC 只处理小残差|16–24 bit|低到中|coarse SAR、residue DAC、ΔΣ fine ADC、digital correction|高精度、高能效，适合传感器|粗细级切换和残差线性度要求高|coarse error、DAC mismatch、residue amplifier nonlinearity|冗余、DAC 校准、chopper/auto-zero|精密传感器、温度/压力/桥式传感器|
|按应用形态|Column-parallel ADC / 列并行 ADC|阵列级并行转换|在图像传感器每列或多列配置 ADC，并行读出像素信号|8–14 bit 常见|单列较低，总吞吐高|single-slope/SAR/cyclic/ΔΣ column ADC、CDS、ramp/counter|高度并行，适合图像阵列|列间固定图案噪声、面积和功耗受限|column offset、ramp mismatch、comparator noise、FPN|CDS、列校准、offset cancellation|CMOS 图像传感器、红外探测器、科学成像|
|按应用形态|Audio ADC|高动态范围低频转换|通常采用 ΔΣ 或 CTSD，针对音频带宽优化噪声和失真|16–24 bit|音频带宽，采样率常见 44.1 kS/s 到数百 kS/s|ΔΣ modulator、PGA、anti-alias/filter、decimation filter|动态范围高，低噪声，数字滤波成熟|延迟和数字滤波复杂，对低频噪声敏感|1/f noise、THD+N、idle tone、jitter|chopper、DEM、低噪声前端、数字滤波|麦克风、音频接口、声学测量|
|按应用形态|Precision Measurement ADC|精密低速转换|优先追求低噪声、高线性度和稳定性，常用 ΔΣ、dual-slope、multi-slope|18–24 bit 甚至更高|低速|低噪声 PGA、参考源、积分器/ΔΣ、数字滤波|精度和稳定性极高|速度慢，系统级漂移和参考噪声关键|offset/gain drift、reference drift、thermal EMF、1/f noise|auto-zero、chopper、系统校准、温漂补偿|DMM、称重、温度、工业仪表、医疗|
|按应用形态|RF-sampling ADC / Direct-RF ADC|直接射频采样|直接对 RF/IF 信号采样并数字下变频，减少模拟下变频级|8–14 bit|GS/s 到数十 GS/s|宽带采样开关、TI-Pipeline/SAR、时钟网络、数字下变频|系统集成度高，频率规划灵活|对 aperture jitter、输入带宽、线性度极其敏感|clock jitter、sampling nonlinearity、input bandwidth mismatch、interleaving spur|时钟优化、TI mismatch 校准、前端线性化|软件无线电、雷达、5G/6G、宽带仪器|
|按应用形态|Compute-in-Memory ADC / 存算一体 ADC|阵列读出低 bit 转换|把 SRAM/RRAM/MRAM 阵列的模拟累加结果转换为数字输出|3–8 bit 常见|阵列吞吐高，单 ADC 速度依设计而定|SAR、Flash、ramp、time-domain、current-mode ADC|低 bit 高并行，适合 AI 加速|面积/能耗极度受限，阵列非理想大|offset、阵列 IR drop、器件变异、噪声、输入范围压缩|低 bit 校准、参考自适应、数字容错、量化感知训练|AI 加速器、CIM、边缘计算|
|按应用形态|Current-input ADC / 电流输入 ADC|电流域采样/积分|直接处理传感器或阵列输出电流，转换为电压/时间/频率/数字码|8–20 bit|低到中|TIA、current integrator、current comparator、current-mode SAR/ΔΣ|适合光电、生物、传感器电流读出|输入动态范围和噪声设计困难|输入电流噪声、leakage、TIA offset、积分器漂移|暗电流校准、offset cancellation、auto-ranging|光电二极管、化学/生物传感、神经接口、CIM 阵列|
|按采样方式|Nyquist-rate ADC|奈奎斯特采样|采样率接近信号带宽需求，主要依靠单次量化精度|覆盖 4–16 bit 以上|低到极高|Flash/SAR/Pipeline/Two-step/TI 等|带宽高，延迟低，适合实时宽带信号|抗噪声和分辨率提升不如过采样天然|采样噪声、jitter、非线性、量化噪声|校准、线性化、前端优化|通信、仪器、雷达、数据采集|
|按采样方式|Oversampling ADC|过采样|采样率显著高于信号带宽，结合数字滤波降低带内噪声|高精度常见|带宽通常低到中等|ΔΣ、NS-SAR、VCO-based、incremental ADC|高分辨率，数字滤波强|带宽/延迟受限，环路设计复杂|量化噪声整形、idle tone、环路稳定性|数字滤波、DEM、噪声整形校准|音频、传感器、工业测量|
|按信号域|Voltage-domain ADC / 电压域 ADC|电压比较/采样|直接以电压为主变量完成采样、DAC 回放、比较和余差处理|覆盖面最广|覆盖面最广|采样开关、比较器、DAC、放大器|直观成熟，参考资料多，适合多数应用|先进低压工艺下电压裕度和模拟增益变差|热噪声、线性度、增益、offset、摆幅|offset/gain/DAC 校准|SAR、Pipeline、Flash、积分型等大多数 ADC|
|按信号域|Charge-domain ADC / 电荷域 ADC|电荷重分配/共享|通过电容采样和电荷重分配完成量化或余差处理|8–16 bit 常见|中到高|CDAC、SC network、charge sharing、bootstrapped switch|低功耗，电容匹配好，适合 CMOS|寄生和开关注入敏感|kT/C、寄生、电容 mismatch、charge injection|电容校准、版图匹配、dummy switch|SAR、SC Pipeline、CDRA、图像传感器|
|按信号域|Time-domain ADC / 时间域 ADC|时间/频率/相位量化|把电压或电流信息转为时间差、频率或相位后数字化|4–16 bit 等效|中到高|VTC、TDC、VCO、delay line、counter|先进 CMOS 友好，数字化程度高|jitter、PVT、非线性校准是核心|delay mismatch、VTC gain、VCO phase noise、TDC DNL|DLL/PLL 校准、数字背景校准、bin calibration|TD ADC、VCO ADC、数字 PLL、先进节点混合 ADC|
|按信号域|Frequency-domain ADC / 频率域 ADC|电压/电流转频率|输入控制振荡频率，在时间窗口内计数或测相位|中低到中高|低到中|VCO/VFC、counter、digital filter|简单、数字友好、天然积分平均|速度和线性度受限，PVT 敏感|VFC/VCO 非线性、温漂、相位噪声|频率校准、查表线性化|传感器、低功耗测量、VCO-based ADC|

## 2. 架构选型与发展趋势

### 2.1 快速选型总结

|应用目标|优先考虑的 ADC 架构|主要原因|
|---|---|---|
|极高速、低中精度|Flash、Folding、Time-Interleaved Flash、TD ADC|转换延迟低，吞吐率最高|
|中速、中高精度、低功耗|SAR、Asynchronous SAR、NS-SAR|能效高，数字友好，面积小|
|高速、中高精度|Pipeline、Pipeline-SAR、TI-Pipeline-SAR|速度和精度折中好，适合宽带通信/仪器|
|低速、超高精度|Dual-Slope、Multi-Slope、ΔΣ、Incremental ΔΣ|噪声低，线性度好，抗干扰强|
|先进 CMOS 高速低压|SAR+TD、VTC+TDC、VCO-based ADC、Pipeline-SAR|模拟增益压力小，利用时间分辨率和数字校准|
|图像传感器列读出|Single-Slope、Column SAR、Cyclic、Column ΔΣ|面积小，可大规模并行|
|RF/宽带直接采样|TI-Pipeline、TI-Pipeline-SAR、RF-sampling ADC|总采样率高，输入带宽大|
|存算一体/AI 加速|Flash、SAR、Ramp、Time-domain、Current-mode ADC|低 bit、大规模并行、面积能耗优先|

### 2.2 现代 ADC 架构发展趋势

|趋势|具体表现|背后原因|
|---|---|---|
|SAR 化|SAR-assisted Pipeline、Pipeline-SAR、Flash-SAR、NS-SAR|SAR 低功耗、数字友好、适合先进 CMOS|
|时间域化|VTC+TDC、SAR+TD、VCO ADC、TDC-assisted ADC|先进工艺中时间分辨率提升，而电压裕度和模拟增益下降|
|噪声整形扩展|ΔΣ、NS-SAR、VCO-based NS ADC、VCO-assisted SAR|用噪声整形提高带内 SNR/DR 和能效|
|动态放大替代传统 OTA|ring amplifier、FIA、dynamic amplifier、CDRA|低电压先进工艺下高增益高速 OTA 难做|
|Time-interleaving 普及|TI-SAR、TI-Pipeline、TI-Pipeline-SAR|单通道速度受限，通过多通道并行提高总采样率|
|数字后台校准增强|gain/offset/skew/DAC mismatch/VTC/TDC 校准|放松模拟精度要求，用数字域恢复线性度和匹配|
|混合域架构增多|SAR+TD、Pipeline+TD、VCO-assisted ADC|单一架构难以同时满足速度、精度、功耗和先进工艺约束|

## 3. 高速混合 ADC 与研究方向

### 3.1 与高速 Pipeline-SAR / SAR+TD 方向的关系

|你的研究方向相关模块|所属 ADC 类型|需要重点关注的问题|
|---|---|---|
|第一级 SAR|SAR ADC / Pipeline-SAR 子级|CDAC mismatch、比较器噪声/失调、采样线性度|
|级间余差放大|Pipeline / Pipeline-SAR|级间增益误差、放大器带宽、输出摆幅、非线性|
|第二级 SAR|SAR-SAR / Pipeline-SAR 细级|转换周期、DAC settling、比较器速度|
|VTC|Time-domain ADC / SAR+TD|VTC gain、offset、线性度、PVT 漂移|
|TDC|Time-domain ADC|TDC LSB、DNL/INL、bin mismatch、jitter|
|数字拼接|Hybrid-domain ADC|电压域权重与时间域权重匹配|
|背景校准|Modern calibrated ADC|级间增益、VTC gain、TDC bin、CDAC mismatch、time skew|

---

## 4. 总结

### 4.1 一句话总结

低速高精度优先考虑积分型和 ΔΣ；中速低功耗优先考虑 SAR；高速中高精度优先考虑 Pipeline/Pipeline-SAR；超高速优先考虑 Flash、Time-Interleaved 和 Time-domain；先进 CMOS 下的核心趋势是 SAR 化、时间域化、噪声整形化、动态放大化和数字校准化。

## 2026 扩展专题：从性能空间到现代混合架构（新增）

> [!info] 证据范围与图示说明
> 原始分类主表和既有结论保留。本节补充**架构推导、系统预算、论文验证的代表实例与工程判断**。图为重新绘制的原创机制示意，不是 IEEE 原论文截图；文献指标按出版物所述标记，其他数值仅为明确假设下的算例。参考 [Murmann ADC Survey 1997–2026](https://github.com/bmurmann/ADC-survey) 与 [IEEE 1241-2023](https://standards.ieee.org/ieee/1241/6797/)。

### A1. 不能只用「精度–采样率」两轴选型

现代架构选型至少具有六个独立维度：**带内信号带宽**、**采样率与 OSR**、**目标 SNDR / SFDR**、**输入频率与模拟前端带宽**、**允许的转换延迟**、**功耗/面积与工艺供电约束**。对高速 ADC，`Fs=20 GS/s` 并不代表可在 `Fin=10 GHz` 保持同一 ENOB；在未给出输入频率时，不应比较两个高速 ADC 的“最佳 SNDR”。另外，多路 TI 是**系统并行组织方式**，可与 SAR、pipeline、flash、NS-SAR 等叠加，而不是与这些转换机制互斥的一类。

![2026_05_专项机制图](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-architectures/2026_05_专项机制图.svg)

*原创专项机制示意；图中比例、相位和结构仅用于说明原理，不代表实际芯片晶体管级拓扑。*

![2026_01_多维架构地图](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-architectures/2026_01_多维架构地图.svg)

从采样保持的角度，至少应建立如下预算：

$$\mathrm{SNR}_{\mathrm{jitter}}=-20\log_{10}(2\pi f_{\mathrm{in}}\sigma_t),\qquad \sigma_t\ll (2\pi f_{\mathrm{in}})^{-1}.$$

此式适用于**正弦输入、随机且与输入独立的有效采样时间误差**。TI 通道间的确定性 skew 会产生周期性 spur，不能直接作为同一个随机 jitter RMS 填入上述式子。量化噪声近似：满量程正弦下理想 Nyquist ADC 的 `SNR_Q≈6.02N+1.76 dB`；对于 1-bit 以上高阶噪声整形结构，需要通过 NTF、OSR 与量化器非线性重新计算，不能照搬该式。

### A2. 同样 12-bit，三种截然不同的系统瓶颈

|候选架构|时钟/模拟瓶颈|优势|真正的系统代价|适合进一步追问|
|---|---|---|---|---|
|单通道高速度 SAR|每一 bit 的 `t_cmp+t_logic+t_DAC`，总转换时窗|低静态功耗，数字友好|参考恢复、开关线性、比较器亚稳态、CDAC 面积|冗余、异步、分段、可变比较时间|
|2-stage Pipeline-SAR|第一级量化 + 余差建立 + 第二级量化的重叠时序|在速度/功耗/精度间折中|MDAC 增益/建立/噪声、级间共模、stage mismatch|级间增益校准、动态放大器、CLS|
|TI-(Pipeline-)SAR|子 ADC 内部时序之外还有前端/时钟扇出|扩展总体吞吐|相位噪声、时间偏斜、带宽失配、输入驱动/THA|层次化采样、时偏/带宽校准、接口吞吐|

**案例——两级 Pipeline-SAR 解析**：假设第一级 5 bit，残差理想增益 `G=16`，第二级拥有 8 bit 加冗余，不意味着输出“5+8=13-bit 绝对有效精度”。最终可用位数由残差范围、数字重叠范围、参考满量程以及噪声/非线性共同决定。令第一级子 DAC 为 `V_DAC1`，则 `V_res=G(V_in−V_DAC1)+e_amp`。数字拼接实质是把细级量化值换算回输入端：

$$\widehat V_{\rm in}=V_{\rm DAC1}+\frac{\widehat V_{\rm res}}{G_{\rm est}}.$$

若 `G_est≠G`，残差相关误差即使在前级 CDAC 理想时也会造成码依赖谐波。因此转换架构不能与校准策略脱离考虑。Lee 与 Flynn 2011 年的 SAR-assisted two-stage pipeline 是可读的经典结构论文；2022 年 DACLS ring amplifier 案例说明动态余差放大与 CLS 结合的方向。[R2][R3]

### A3. 噪声整形 SAR 与 ΔΣ 为什么既相似又不同

两者共有的数学目标是：通过环路或误差反馈把量化噪声的传递函数 `NTF(z)` 在信号带内压低。典型一阶误差反馈写为 `Y(z)=X(z)+(1−z^{-1})E(z)`；若环路实现改变，这并不自动成立。**NS-SAR**常用 SAR CDAC/比较器同时完成多位量化与误差提取，集成在逐次逼近周期中；**ΔΣ**主要依靠持续时间域或离散时间积分器的高 OSR 闭环调制。两者可以组合，也不能仅根据“使用积分器”或“有噪声整形”一词断定 ADC 类型。设计时要检查环路状态摆幅、延迟、非理想 NTF、比较器残余噪声及 out-of-band noise。详见 Pavan、Schreier、Temes 的系统教材。[R4]

![2026_02_量化与误差整形](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-architectures/2026_02_量化与误差整形.svg)

### A4. 读论文和筛选架构时必须统一的指标

1. **SNDR / ENOB**：记录 `Fin`、FFT 点数、窗函数、输入幅度与是否 Nyquist；`ENOB=(SNDR−1.76)/6.02`。
2. **FoM**：Walden `FoM_W=P/(2^{ENOB}F_s)`，Schreier `FoM_S=SNDR+10log10(BW/P)`；两者偏好不同，不能仅按一个 FoM 排序。
3. **系统开销**：对 TI 架构，将 PLL/MPCG、前端 buffer/THA、数字后台校准、输出 PHY 逐项计入；很多论文的核 ADC 功耗与整个系统功耗边界不相同。
4. **验证边界**：分别列出 schematic/post-layout、测试芯片实测和计算值；标出 `FSR` 是单端还是差分峰峰值。

![2026_03_架构决策流程](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-architectures/2026_03_架构决策流程.svg)

**研究追问**：选定目标为高速 12-bit 时，先做系统噪声/非线性/抖动预算，再据此反推 ① 每级位数与冗余 ② 余差增益与建立时间 ③ 时钟层级与 skew ④ 片上数字输出/采集方式。避免“先选最前沿结构，再寻找指标”造成不必要的结构复杂度。

### A5. 新增经过核验的核心文献与资料

- [R1] B. Murmann, *ADC Performance Survey 1997–2026*, Stanford，持续更新的 ISSCC/VLSI 数据集合。<https://github.com/bmurmann/ADC-survey>。
- [R2] C.-C. Lee and M. P. Flynn, “A SAR-Assisted Two-Stage Pipeline ADC,” *IEEE JSSC*, 46(4), 2011, DOI: [10.1109/JSSC.2011.2108133](https://doi.org/10.1109/JSSC.2011.2108133)。
- [R3] J.-C. Wang and T.-H. Kuo, “A 72-dB SNDR 130-MS/s 0.8-mW Pipelined-SAR ADC Using a Distributed Averaging Correlated Level Shifting Ring Amplifier,” *IEEE JSSC*, 2022, DOI: [10.1109/JSSC.2022.3196743](https://doi.org/10.1109/JSSC.2022.3196743)。
- [R4] S. Pavan, R. Schreier, and G. C. Temes, *Understanding Delta-Sigma Data Converters*, 2nd ed., Wiley-IEEE Press, 2017, DOI: [10.1002/9781119258308](https://doi.org/10.1002/9781119258308)。
- [R5] B. Murmann, “The successive approximation register ADC: a versatile building block for ultra-low-power to ultra-high-speed applications,” *IEEE Communications Magazine*, 2016, DOI: [10.1109/MCOM.2016.7452270](https://doi.org/10.1109/MCOM.2016.7452270)。
- [R6] J. L. McCreary, *Successive Approximation Analog-to-Digital Conversion Techniques in MOS Integrated Circuits*, UC Berkeley technical report, 1975. [机构存档](https://www2.eecs.berkeley.edu/Pubs/TechRpts/1975/7366.html)。
- [R7] IEEE Std 1241-2023, *IEEE Standard for Terminology and Test Methods for Analog-to-Digital Converters*. [官方标准](https://standards.ieee.org/ieee/1241/6797/)。
- [R8] B. P. Hershberg et al., “Ring Amplifiers for Switched-Capacitor Circuits,” *ISSCC*, 2012, DOI: [10.1109/ISSCC.2012.6177090](https://doi.org/10.1109/ISSCC.2012.6177090)。

**论文配图线索**：R2 的 architecture / residue stage；R3 的 DACLS ring amplifier 和 timing；R4 的 NTF 示意。由于未随本次材料提供对应论文 PDF 和再分发授权，此处仅提供原文定位，不冒用论文原图；上方三张为本笔记新绘制示意。

### 定量分析图（理论/指定参数示意）

![2026_04_理论参数曲线](/GarveyDing_AcademicPages/images/blog/learning-notes/adc-architectures/2026_04_理论参数曲线.png)

> 上图为数学模型/显式参数下计算的示意曲线，不是论文测量，也不是 TSMC 28 nm PDK 提取结果。实际结论需结合文中定义、完整寄生与时序验证。

---