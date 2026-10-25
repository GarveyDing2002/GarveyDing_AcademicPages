---
title: PVT 对 MOS 管性能参数的影响
date: 2026-05-21
excerpt: 系统总结 Process、Voltage、Temperature 对 MOS 参数和 ADC 关键模块的影响及验证方法。
tags:
  - 学习记录
  - 模拟集成电路
  - analog-ic
  - pvt
  - mos
---

> **核心定位**
> 系统总结 Process、Voltage、Temperature 对 MOS 参数和 ADC 关键模块的影响及验证方法。

---


> **层次化结构**
> 本版将原笔记的并列分点重构为 **6 个主章节 → 主题小节 → 具体知识点**。原有正文、公式、表格与参考资料保持不变，主要调整标题层级与导航结构。

## 目录

1. PVT 基础与 MOS 核心参数
   - 1.1 PVT 的基本含义
   - 1.2 MOS 管关键参数
   - 1.3 特征频率 $f_T$
2. Process、Voltage 与 Temperature 三个维度
   - 2.1 Process Corner 对 MOS 管性能的影响
   - 2.2 Voltage 对 MOS 管性能的影响
   - 2.3 Temperature 对 MOS 管性能的影响
3. 噪声、失配与泄漏
   - 3.1 PVT 对噪声、失配和泄漏的影响
4. PVT 对 SAR ADC 关键模块的影响
   - 4.1 PVT 对 SAR ADC 关键模块的影响
   - 4.2 针对比较器的 PVT 检查重点
5. Worst-Case 组合与仿真验证
   - 5.1 PVT 影响总表
   - 5.2 常见 Worst-Case 组合
   - 5.3 仿真建议
6. 总结
   - 6.1 总结
   - 6.2 一句话总结

## 1. PVT 基础与 MOS 核心参数

### 1.1 PVT 的基本含义

PVT 是集成电路设计中用于评估电路鲁棒性的三个主要变化维度：


$$
\text{PVT}=\text{Process}+\text{Voltage}+\text{Temperature}
$$




其中：

|项目|含义|主要影响|
|---|---|---|
|Process|工艺角变化，如 TT、SS、FF、SF、FS|器件阈值、电流能力、迁移率、寄生、电阻、电容|
|Voltage|电源电压、输入共模、体偏置、参考电压变化|过驱动电压、电流、速度、摆幅、headroom|
|Temperature|温度变化，如 -40 ℃、27 ℃、125 ℃|迁移率、阈值、泄漏、噪声、金属电阻|

PVT 变化最终会反映到 MOS 管的以下性能参数上：


$$
V_{th},\quad V_{ov},\quad I_D,\quad g_m,\quad r_o,\quad C_{par},\quad f_T,\quad R_{on},\quad noise,\quad leakage
$$




---


### 1.2 MOS 管关键参数

#### 阈值电压 $V_{th}$

阈值电压决定 MOS 管开始强导通所需的栅源电压。

常用关系：


$$
V_{ov}=V_{GS}-V_{th}
$$




其中 $V_{ov}$ 是过驱动电压。

一般趋势：

|条件|$V_{th}$ 变化|
|---|---|
|SS 角|增大|
|FF 角|减小|
|温度升高|减小|
|温度降低|增大|
|反向体偏置增强|增大|
|正向体偏置增强|减小|

低温下 $V_{th}$ 增大，可能导致：


$$
V_{ov}\downarrow \Rightarrow I_D\downarrow \Rightarrow g_m\downarrow \Rightarrow speed\downarrow
$$




这也是低压模拟电路、比较器、自偏置电路在低温 SS 角可能变慢的重要原因。

---

#### 过驱动电压 $V_{ov}$


$$
V_{ov}=V_{GS}-V_{th}
$$




$V_{ov}$ 直接影响电流、跨导、速度和输出摆幅。

|条件|$V_{ov}$ 变化|影响|
|---|---|---|
|$V_{GS}$ 降低|减小|电流下降、速度变慢|
|$V_{th}$ 增大|减小|电流下降、开关导通变差|
|输入共模变化|可能增大或减小|影响输入对管工作点|
|低温|可能减小|取决于偏置方式|

对于固定偏置电压电路，低温下 $V_{th}$ 增大时，$V_{ov}$ 很容易下降。

---

#### 漏极电流 $I_D$

强反型饱和区近似：


$$
I_D \approx \frac{1}{2}\mu C_{ox}\frac{W}{L}V_{ov}^2
$$




因此 $I_D$ 受以下因素影响：


$$
I_D \propto \mu \cdot \frac{W}{L}\cdot V_{ov}^2
$$




|条件|$I_D$ 变化|
|---|---|
|FF 角|增大|
|SS 角|减小|
|$V_{ov}$ 升高|增大|
|$V_{ov}$ 降低|减小|
|高温|不一定，通常迁移率下降使电流下降|
|低温|不一定，迁移率上升但 $V_{th}$ 也上升|

注意：

- 如果电路采用理想恒流偏置，则 $I_D$ 变化较小；

- 如果电路采用固定栅压偏置，则 $I_D$ 对 $V_{th}$ 和温度非常敏感；

- 在低电压、低 $V_{ov}$ 电路中，低温 $V_{th}$ 上升可能使电流明显下降。


---

#### 跨导 $g_m$

跨导定义为：


$$
g_m=\frac{\partial I_D}{\partial V_{GS}}
$$




强反型近似：


$$
g_m \approx \frac{2I_D}{V_{ov}}
$$




或者：


$$
g_m \approx \sqrt{2\mu C_{ox}\frac{W}{L}I_D}
$$




$g_m$ 是模拟电路中极其关键的参数，直接影响：

- 放大器增益；

- 放大器带宽；

- 比较器预放大级速度；

- latch 再生速度；

- 噪声；

- $f_T$。


|条件|$g_m$ 变化趋势|
|---|---|
|FF 角|通常增大|
|SS 角|通常减小|
|$V_{ov}$ 降低|通常减小|
|偏置电流下降|减小|
|固定电流偏置下低温|不一定，可能增加|
|固定栅压偏置下低温|可能减小|

在比较器预放大级中：


$$
\tau_{pre} \approx \frac{C_L}{g_m}
$$




因此：


$$
g_m\downarrow \Rightarrow \tau_{pre}\uparrow \Rightarrow \Delta V_{preamp}(t)\downarrow
$$




最终会导致 latch 初始差分电压变小，比较时间变长。

---

#### 输出电阻 $r_o$

输出电阻：


$$
r_o=\frac{1}{g_{ds}}
$$




小信号增益近似：


$$
A_v \approx g_m r_o
$$




一般趋势：

|条件|$r_o$ 变化|
|---|---|
|电流增大|通常减小|
|电流减小|通常增大|
|FF 角|可能减小|
|SS 角|可能增大|
|短沟道效应增强|减小|
|$V_{DS}$ 余量不足|有效输出电阻下降|

需要注意：

- SS 角下速度通常变慢，但 $r_o$ 可能变大；

- FF 角下速度通常变快，但 $r_o$ 可能变小；

- 因此增益 worst case 不一定出现在 SS 角。


---

#### 寄生电容 $C_{par}$

MOS 管主要寄生电容包括：


$$
C_{gs},\quad C_{gd},\quad C_{gb},\quad C_{db},\quad C_{sb},\quad C_{gg}
$$




寄生电容影响：

- 输入带宽；

- 输出极点；

- 时钟 feedthrough；

- kickback；

- latch 再生速度；

- $C_L$。


基本速度关系：


$$
\tau \approx \frac{C_L}{g_m}
$$




或者：


$$
t_d \approx \frac{C_L V_{swing}}{I_D}
$$




PVT 下，寄生电容的变化通常小于电流和 $g_m$ 的变化，但在高速 ADC、比较器、bootstrapped switch 和 TDC/VTC 中，寄生电容仍然非常关键。

---


### 1.3 特征频率 $f_T$

#### $f_T$ 的定义

MOS 管的特征频率 $f_T$ 是指电流增益下降到 1 时的频率。它可以粗略表示器件的本征速度能力。

常用近似式：


$$
f_T \approx \frac{g_m}{2\pi C_{gg}}
$$




其中：


$$
C_{gg}=C_{gs}+C_{gd}+C_{gb}
$$




因此：


$$
f_T \uparrow \Longleftrightarrow g_m \uparrow \quad \text{或} \quad C_{gg}\downarrow
$$




更直观地说，$f_T$ 反映了 MOS 管用自身跨导驱动自身栅电容的速度上限。

---

#### $f_T$ 与偏置电流的关系

在一定范围内，随着偏置电流增加：


$$
I_D\uparrow \Rightarrow g_m\uparrow \Rightarrow f_T\uparrow
$$




但是 $f_T$ 不会无限增大。

原因是：

1. 高电流下速度饱和效应增强；

2. 载流子迁移率退化；

3. $g_m/I_D$ 下降；

4. 寄生电容随偏置和尺寸增加；

5. 过高电流会使功耗和非线性增加。


因此 $f_T$ 通常随电流密度先上升，然后趋于饱和，甚至下降。

---

#### $f_T$ 与沟道长度的关系

短沟道器件一般具有更高的 $f_T$：


$$
L\downarrow \Rightarrow C_{gg}\downarrow,\quad transit\ time\downarrow \Rightarrow f_T\uparrow
$$




但短沟道器件也会带来：

- $r_o$ 降低；

- intrinsic gain 降低；

- DIBL 增强；

- mismatch 可能变差；

- flicker noise 可能变差；

- 电压裕量变差。


所以高速电路常用短沟道管，而高增益模拟电路可能需要适当加长沟道。

---

#### PVT 对 $f_T$ 的影响

由：


$$
f_T \approx \frac{g_m}{2\pi C_{gg}}
$$




可知，PVT 对 $f_T$ 的影响主要来自 $g_m$ 和寄生电容变化。

|条件|对 $f_T$ 的影响|
|---|---|
|FF 角|$g_m$ 增大，$f_T$ 通常升高|
|SS 角|$g_m$ 减小，$f_T$ 通常降低|
|$I_D$ 升高|$g_m$ 增大，$f_T$ 增大，$f_T$ 通常升高|
|$I_D$ 降低|$g_m$ 减小，$f_T$ 减小，$f_T$ 通常降低|
|高温|迁移率下降，$g_m$ 下降，$f_T$ 通常降低|
|低温|迁移率上升有利于 $g_m$，但 $V_{th}$ 上升可能使电流下降|
|固定电流偏置低温|$f_T$ 可能提高|
|固定栅压偏置低温|$f_T$ 可能降低|

因此，低温下 $f_T$ 不一定提高，要看偏置方式。

---

#### $f_T$ 与电路速度的区别

$f_T$ 是器件本征速度指标，但电路速度还取决于：


$$
C_L,\quad I_D,\quad V_{swing},\quad topology,\quad bias,\quad loading
$$




例如比较器预放大级速度：


$$
\tau_{pre}\approx \frac{C_L}{g_m}
$$




latch 再生速度：


$$
\tau_{reg}\approx \frac{C_L}{g_{m,n}+g_{m,p}}
$$




数字门延迟：


$$
t_d\approx \frac{C_LV_{DD}}{I_{drive}}
$$




所以即使单管 $f_T$ 很高，如果负载电容大、偏置电流小、输出摆幅大，实际电路仍然可能很慢。

在高速 ADC 设计中，不能只看 $f_T$，还要看：

- 实际负载下的建立时间；

- 实际工作点下的 $g_m$；

- 实际输出摆幅；

- 寄生电容；

- 时钟边沿速度；

- PVT 下的 margin。


---


## 2. Process、Voltage 与 Temperature 三个维度

### 2.1 Process Corner 对 MOS 管性能的影响

#### 常见工艺角

|Corner|NMOS|PMOS|含义|
|---|---|---|---|
|TT|Typical|Typical|典型角|
|FF|Fast|Fast|NMOS 和 PMOS 都快|
|SS|Slow|Slow|NMOS 和 PMOS 都慢|
|FS|Fast|Slow|NMOS 快、PMOS 慢|
|SF|Slow|Fast|NMOS 慢、PMOS 快|

---

#### SS 角

SS 角通常表现为：


$$
V_{th}\uparrow,\quad \mu\downarrow,\quad I_D\downarrow,\quad g_m\downarrow
$$




影响总结：

|参数|SS 角趋势|
|---|---|
|$V_{th}$|增大|
|$V_{ov}$|减小|
|$I_D$|减小|
|$g_m$|减小|
|$r_o$|可能增大|
|$f_T$|降低|
|$R_{on}$|增大|
|延迟|增大|
|带宽|降低|
|泄漏|减小|

对 SAR ADC 的影响：

- 比较器预放大级变慢；

- latch 再生变慢；

- CDAC 开关导通电阻增大；

- DAC settling 变差；

- SAR logic 延迟增大；

- bootstrapped switch 驱动能力变弱；

- 异步 SAR 的 EOC 可能变晚。


---

#### FF 角

FF 角通常表现为：


$$
V_{th}\downarrow,\quad \mu\uparrow,\quad I_D\uparrow,\quad g_m\uparrow
$$




影响总结：

|参数|FF 角趋势|
|---|---|
|$V_{th}$|减小|
|$V_{ov}$|增大|
|$I_D$|增大|
|$g_m$|增大|
|$r_o$|可能减小|
|$f_T$|升高|
|$R_{on}$|减小|
|延迟|减小|
|带宽|增大|
|泄漏|增大|

FF 角速度通常更快，但风险包括：

- 动态节点泄漏增加；

- latch kickback 增强；

- 时钟 feedthrough 增强；

- 数字噪声耦合增强；

- 功耗增加；

- 相位裕度可能下降；

- 参考电压扰动可能更严重。


---

#### FS / SF 角

FS / SF 角主要反映 NMOS 和 PMOS 速度不匹配。

|Corner|特点|
|---|---|
|FS|NMOS 快，PMOS 慢|
|SF|NMOS 慢，PMOS 快|

影响：

- CMOS inverter 上升/下降延迟不对称；

- 时钟占空比失真；

- latch 再生路径不平衡；

- 比较器 offset 增大；

- CML-to-CMOS 转换点偏移；

- 数字门延迟方向不一致；

- 差分输出 common-mode 偏移。


在比较器中，FS/SF 角往往用于检查：


$$
V_{OS},\quad duty\ cycle,\quad rise/fall\ mismatch,\quad metastability
$$




---


### 2.2 Voltage 对 MOS 管性能的影响

#### 电源电压降低

当 $V_{DD}$ 降低时：


$$
V_{ov}\downarrow,\quad I_D\downarrow,\quad g_m\downarrow
$$




影响总结：

|参数|$V_{DD}$ 降低趋势|
|---|---|
|$V_{ov}$|减小|
|$I_D$|减小|
|$g_m$|减小|
|$f_T$|降低|
|$R_{on}$|增大|
|输出摆幅|减小|
|headroom|变差|
|延迟|增大|
|动态范围|减小|

对 ADC 的影响：

- 采样开关 $R_{on}$ 变大；

- 比较器速度下降；

- latch 再生速度下降；

- DAC switch driver 速度下降；

- SAR logic 延迟增加；

- residue amplifier 输出摆幅和线性度变差；

- VREF buffer 驱动能力下降。


---

#### 电源电压升高

当 $V_{DD}$ 升高时：


$$
V_{ov}\uparrow,\quad I_D\uparrow,\quad g_m\uparrow
$$




影响总结：

|参数|$V_{DD}$ 升高趋势|
|---|---|
|$V_{ov}$|增大|
|$I_D$|增大|
|$g_m$|通常升高|
|速度|变快|
|输出摆幅|增大|
|功耗|增大|
|泄漏|增大|
|kickback|增强|
|feedthrough|增强|

高电源电压通常有利于速度，但可能带来可靠性和噪声耦合问题。

---

#### 输入共模电压变化

输入共模 $V_{CM}$ 会影响输入对管的 $V_{ov}$、$g_m$ 和工作区。

对于 NMOS 输入对：


$$
V_{CM}\downarrow \Rightarrow V_{GS}\downarrow \Rightarrow V_{ov}\downarrow \Rightarrow g_m\downarrow
$$




对于 PMOS 输入对，趋势相反。

输入共模变化会影响：

- 预放大级 $g_m$；

- 输入范围；

- 比较器 offset；

- latch 初始工作点；

- 采样开关线性度；

- bootstrapped switch 可靠性；

- residue amplifier 输入余量。


---

#### 体偏置变化

体效应公式：


$$
V_{th}=V_{th0}+\gamma\left(\sqrt{2\phi_F+V_{SB}}-\sqrt{2\phi_F}\right)
$$




对于 NMOS：


$$
V_{SB}\uparrow \Rightarrow V_{th}\uparrow \Rightarrow I_D\downarrow
$$




体偏置影响：

- 阈值电压；

- 开关导通电阻；

- 输入对管跨导；

- offset；

- 泄漏；

- latch 再生速度。


在普通 NMOS 采样开关中，输入电压升高会导致 $V_{SB}$ 增大，体效应增强，使 $V_{th}$ 变大，这是采样非线性的来源之一。

---


### 2.3 Temperature 对 MOS 管性能的影响

#### 温度升高

温度升高时主要有两个相反效应：


$$
\mu\downarrow
$$





$$
V_{th}\downarrow
$$




其中：

- 迁移率下降会让器件变慢；

- 阈值下降会让器件更容易导通。


多数强反型高速电路中，高温通常使速度变慢，因为迁移率下降占主导。

影响总结：

|参数|高温趋势|
|---|---|
|$\mu$|降低|
|$g_m$|降低|
|$I_D$|不一定，常见为下降|
|$f_T$|常见为下降|
|速度|通常降低|
|延迟|通常增大|
|泄漏|显著增大|
|热噪声|增大|
|金属电阻|增大|

高温主要风险：

- 泄漏严重；

- 动态节点保持变差；

- 热噪声增大；

- 金属线和开关电阻上升；

- reference settling 变差；

- 数字逻辑速度下降。


---

#### 温度降低

温度降低时：


$$
\mu\uparrow
$$





$$
V_{th}\uparrow
$$




因此低温对速度的影响不一定单调。

|条件|低温影响|
|---|---|
|迁移率上升占主导|电路变快|
|阈值上升占主导|电路变慢|
|固定电流偏置|速度可能提升|
|固定栅压偏置|电流可能下降，速度变慢|
|低电源电路|更容易因 $V_{th}$ 上升而变慢|

低温下的主要风险：

- $V_{th}$ 增大导致 $V_{ov}$ 不足；

- 自偏置电流下降；

- 比较器预放大级输出建立不足；

- 开关导通电阻变大；

- latch 再生起始电流不足；

- bandgap / bias 电路工作点偏移。


---


## 3. 噪声、失配与泄漏

### 3.1 PVT 对噪声、失配和泄漏的影响

#### 热噪声

MOS 热噪声近似：


$$
\overline{i_n^2}=4kT\gamma g_m
$$




输入等效噪声可近似理解为：


$$
\overline{v_{n,in}^2}\propto \frac{kT}{g_m}
$$




因此：

|条件|噪声影响|
|---|---|
|高温|kT 增大，热噪声增大|
|$g_m$ 降低|输入等效噪声增大|
|偏置电流降低|通常噪声变差|
|增大电容|kT/C 噪声降低|

---

#### 1/f 噪声

1/f 噪声通常与器件面积相关：


$$
v_{n,1/f}^2 \propto \frac{1}{WL}
$$




影响规律：

- 器件面积越大，1/f 噪声越小；

- PMOS 通常比 NMOS 有更低的 1/f 噪声；

- 先进工艺下 1/f 噪声和界面态、工艺有关。


---

#### 失配

随机失配常用 Pelgrom 模型：


$$
\sigma(\Delta V_{th})=\frac{A_{VT}}{\sqrt{WL}}
$$




失配主要由器件尺寸和版图决定，属于 mismatch / Monte Carlo 范畴，不等同于 PVT corner。

但 PVT 会改变失配的电路表现。

例如比较器中，如果 PVT 导致预放大级有效增益下降，则相同输入对管失配会表现为更大的输入等效 offset。

---

#### 泄漏

泄漏包括：

- 亚阈值泄漏；

- PN 结泄漏；

- 栅泄漏；

- GIDL；

- 动态节点泄漏。


泄漏 worst case 通常是：


$$
FF,\quad V_{DD,max},\quad T_{max}
$$




高温下泄漏会显著增加，可能导致：

- 动态 latch 节点保持失败；

- SAR 动态逻辑错误；

- bootstrapped switch 内部电容掉电；

- CDAC top-plate 电荷泄漏；

- memory/register 状态异常。


---


## 4. PVT 对 SAR ADC 关键模块的影响

### 4.1 PVT 对 SAR ADC 关键模块的影响

#### 采样开关

普通 NMOS 开关导通电阻近似：


$$
R_{on}\approx \frac{1}{\mu C_{ox}\frac{W}{L}(V_{GS}-V_{th})}
$$




SS、低电源、低温下：


$$
V_{GS}-V_{th}\downarrow \Rightarrow R_{on}\uparrow
$$




影响：

- 采样带宽下降；

- 采样建立误差增大；

- 高频输入下 SNDR 下降；

- $R_{on}$ 非线性增强；

- SFDR 变差。


自举开关可以使：


$$
V_{GS}\approx \text{constant}
$$




从而改善 $R_{on}$ 线性度，但 PVT 仍会影响 boost 电压建立、boot 电容充放电速度和开关驱动能力。

---

#### CDAC 与参考网络

PVT 对 CDAC 的影响主要包括：

- 电容绝对值变化；

- 电容比例误差；

- 寄生电容变化；

- bottom-plate switch 速度变化；

- VREF buffer 输出阻抗变化；

- VREF settling 变化。


对于 SAR ADC：


$$
\Delta Q=C\Delta V
$$




每一步 CDAC 切换都会从参考端吸收电荷。如果参考电压建立不充分，会产生码相关误差，引起：

- INL/DNL 变差；

- SFDR 下降；

- SNDR 下降；

- 通道间 mismatch 增大。


---

#### 比较器预放大级

预放大级速度：


$$
\tau_{pre}\approx \frac{C_L}{g_m}
$$




输出建立：


$$
\Delta V_{out}(t)=A_v\Delta V_{in}\left(1-e^{-t/\tau_{pre}}\right)
$$




SS、低电源、低温下可能出现：


$$
I_{tail}\downarrow,\quad g_m\downarrow,\quad f_T\downarrow,\quad BW\downarrow
$$




导致：


$$
\Delta V_{preamp}(t_{latch,start})\downarrow
$$




latch 再生时间：


$$
t_{reg}\approx \tau_{reg}\ln\left(\frac{V_{logic}}{\Delta V_0}\right)
$$




其中 $\Delta V_0$ 是 latch 使能瞬间的初始差分电压。

因此：


$$
\Delta V_0\downarrow \Rightarrow t_{reg}\uparrow
$$




---

#### Dynamic latch

latch 再生时间常数：


$$
\tau_{reg}\approx \frac{C_L}{g_{m,n}+g_{m,p}}
$$




SS、低电源下：


$$
g_{m,n}+g_{m,p}\downarrow \Rightarrow \tau_{reg}\uparrow
$$




FS/SF 角下：

- NMOS/PMOS 再生不对称；

- 输出 rise/fall time 不匹配；

- latch offset 增大；

- metastability 概率增加。


需要检查：

- latch reset 是否完全；

- latch regeneration time；

- 输入等效 offset；

- kickback；

- metastability window；

- 输出 buffer 延迟。


---

#### SAR Logic 与 DAC Driver

数字延迟近似：


$$
t_d\approx \frac{C_LV_{DD}}{I_{drive}}
$$




SS、低电源、高温或低温 $V_{th}$ 上升时：


$$
I_{drive}\downarrow \Rightarrow t_d\uparrow
$$




影响：

- SAR logic 输出延迟增大；

- CDAC 控制开关建立变慢；

- 异步 SAR 每一 bit 周期拉长；

- EOC 变晚；

- conversion time margin 变小。


---

#### Residue Amplifier / Dynamic Amplifier

对于 pipeline-SAR ADC，PVT 会显著影响 residue amplifier：


$$
A_v,\quad GBW,\quad settling,\quad output\ swing,\quad CMFB,\quad noise
$$




SS、低电源下：

- 增益下降或不稳定；

- 建立时间变长；

- 输出摆幅不足；

- 共模点偏移；

- 非线性增强；

- interstage gain error 增大。


动态放大器中：


$$
A_v(t),\quad g_m(t),\quad I(t)
$$




都强烈依赖 PVT，因此需要特别检查 corner 下的 residue gain 和 settling。

---


### 4.2 针对比较器的 PVT 检查重点

对于“预放大级 + latch”结构的 SAR ADC 比较器，应重点检查：

#### 预放大级

|检查项|关注点|
|---|---|
|$g_m$|SS 低温下是否明显下降|
|输入对管 $V_{ov}$|是否下降|
|输入对管 $I_D$|是否过小|
|负载管工作区|是否仍在正确 region|
|输出共模|是否偏移|
|输出差分电压|latch 使能前是否足够|
|$f_T$|输入对管和负载管速度能力是否下降|
|输出节点带宽|是否满足预放大时间|

关键波形：


$$
\Delta V_{preamp}(t_{latch,start})
$$




如果这个量在 SS 低温下明显变小，则 latch 再生时间会明显增大。

---

#### Latch

|检查项|关注点|
|---|---|
|$g_{m,n}+g_{m,p}$|再生能力|
|$\tau_{reg}$|再生时间常数|
|reset 节点|是否完全复位|
|输出差分建立|是否满足 SAR 时序|
|kickback|是否影响 CDAC top plate|
|FS/SF offset|再生路径是否不平衡|

latch 再生时间近似：


$$
t_{reg}\approx \frac{C_L}{g_{m,n}+g_{m,p}} \ln\left(\frac{V_{logic}}{\Delta V_0}\right)
$$




因此比较器变慢可能来自两个方面：

1. $g_m$ 下降，导致再生时间常数变大；

2. $\Delta V_0$ 下降，导致再生需要更长时间。


---


## 5. Worst-Case 组合与仿真验证

### 5.1 PVT 影响总表

|条件|$V_{th}$|$V_{ov}$|$I_D$|$g_m$|$r_o$|$f_T$|$R_{on}$|速度|泄漏|
|---|---|---|---|---|---|---|---|---|---|
|SS|↑|↓|↓|↓|可能↑|↓|↑|慢|↓|
|FF|↓|↑|↑|↑|可能↓|↑|↓|快|↑|
|$V_{DD}$ 降低|—|—|↓|↓|变化|↓|↑|慢|↓|
|$V_{DD}$ 升高|—|—|↑|↑|变化|↑|↓|快|↑|
|$T$ 升高|↓|↓|不一定|通常↓|变化|通常↓|通常↑|通常慢|↑↑|
|$T$ 降低|↑|↑|不一定|不一定|变化|不一定|不一定|不一定|↓|

---


### 5.2 常见 Worst-Case 组合

#### 速度最慢角

传统数字逻辑常见最慢角：


$$
SS,\quad V_{DD,min},\quad T_{max}
$$




但对于低压模拟电路、比较器、自偏置电路，最慢角也可能是：


$$
SS,\quad V_{DD,min},\quad T_{min}
$$




原因是低温下：


$$
V_{th}\uparrow \Rightarrow V_{ov}\downarrow \Rightarrow I_D\downarrow \Rightarrow g_m\downarrow \Rightarrow f_T\downarrow
$$




尤其对于固定栅压偏置或自偏置电路，这种情况非常常见。

---

#### 泄漏最严重角


$$
FF,\quad V_{DD,max},\quad T_{max}
$$




此时：


$$
V_{th}\downarrow,\quad VDD\uparrow,\quad T\uparrow
$$




泄漏最大。

---

#### 增益最差角

增益：


$$
A_v\approx g_mr_o
$$




其 worst case 不一定固定，可能出现在：

- FF 角：$V_{th}$ 降低；

- SS 角：$g_m$ 降低；

- 低电源：输出摆幅和 $V_{ov}$ 余量不足；

- 高温：迁移率降低、$g_m$ 降低。


因此模拟增益需要在所有 PVT 组合下仿真。

---

#### 采样线性度最差角

通常需要重点检查：


$$
SS,\quad V_{DD,min},\quad T_{min}
$$




因为此时开关 $R_{on}$ 可能最大，采样建立最差。

但高温 FF 角也需要检查泄漏和 feedthrough 问题。

---

#### 比较器 offset 最差角

比较器 offset 通常需要检查：


$$
FS,\quad SF,\quad mismatch,\quad VCM,\quad VDD
$$




FS/SF 角会导致 NMOS/PMOS 再生能力不平衡，从而增加 latch offset 和输出不对称。

---


### 5.3 仿真建议

#### Operating Point 检查

对关键 MOS 管导出以下参数：

|参数|含义|
|---|---|
|$I_D$|漏极电流|
|$g_m$|跨导|
|$g_{ds}$|输出电导|
|$r_o$|输出电阻|
|$V_{th}$|阈值电压|
|$V_{GS}$|栅源电压|
|$V_{DS}$|漏源电压|
|$V_{ov}$ / $V_{DS,sat}$|过驱动或饱和电压|
|$C_{gg}$|总栅电容|
|$C_{gs}$, $C_{gd}$|栅源、栅漏电容|
|$f_T$|特征频率|
|region|工作区|

---

#### Transient 检查

对比较器和 SAR ADC，建议检查：

|波形|目的|
|---|---|
|preamp 输出差分|判断预放大是否足够|
|preamp 输出共模|判断 latch 输入工作点|
|latch 输出差分|判断再生时间|
|latch reset 节点|判断复位是否完全|
|comparator decision time|判断是否超出 bit cycle|
|SAR logic 控制信号|判断逻辑延迟|
|CDAC top-plate|判断 DAC settling|
|VREF 节点|判断参考建立和 droop|
|EOC|判断整体转换时序|

---

#### 推荐的比较器速度分解

将比较器总延迟拆成：


$$
t_{comp}=t_{preamp}+t_{latch}+t_{logic}
$$




其中：

- $t_{pre}$：预放大输出建立时间；

- $t_{reg}$：latch 再生时间；

- $t_{buf}$：输出 buffer 和后级逻辑延迟。


在 SS 低温下，如果：


$$
\Delta V_{preamp}(t_{latch,start})\downarrow
$$




说明主要问题在预放大级。

如果：


$$
\Delta V_{preamp}(t_{latch,start})
$$




足够，但 latch 输出仍然慢，说明主要问题在 latch 再生能力。

如果 latch 输出已经完成，但下一位 DAC 控制信号很慢，说明问题在 SAR logic 或 DAC driver。

---


## 6. 总结

### 6.1 总结

PVT 对 MOS 管性能参数的影响可以归纳为：


$$
P:\quad V_{th},\ \mu,\ L_{eff},\ R_s,\ C_{par}\ \text{变化}
$$





$$
V:\quad V_{ov},\ I_D,\ g_m,\ headroom,\ swing,\ speed\ \text{变化}
$$





$$
T:\quad \mu,\ V_{th},\ leakage,\ noise,\ metal\ R\ \text{变化}
$$




其中，速度相关的核心链路是：


$$
V_{ov}\downarrow \Rightarrow I_D\downarrow \Rightarrow g_m\downarrow \Rightarrow f_T\downarrow \Rightarrow BW\downarrow \Rightarrow delay\uparrow
$$




对于高速 SAR ADC，尤其要关注：


$$
R_{on},\quad DAC\ settling,\quad \Delta V_{preamp},\quad t_{reg},\quad SAR\ logic\ delay,\quad f_T
$$




对“预放大级 + latch”比较器来说，最关键的判断量是：


$$
\Delta V_{preamp}(t_{latch,start})
$$




因为 latch 再生时间满足：


$$
t_{reg}\propto \ln\left(\frac{1}{\Delta V_0}\right)
$$




当 PVT 导致预放大输出初始差分电压变小时，即使 latch 本身没有严重退化，整体比较时间也会显著变长。

---


### 6.2 一句话总结

PVT 的本质是改变 MOS 管的：


$$
V_{th},\ \mu,\ I_D,\ g_m,\ r_o,\ C_{par},\ f_T
$$




进而改变电路的：


$$
speed,\ gain,\ bandwidth,\ noise,\ leakage,\ offset,\ settling,\ linearity
$$




在高速 SAR ADC 中，最需要关注的是：


$$
SS/V_{DD,min}/T_{min\ or\ max}
$$




下的比较器速度、采样开关 $R_{on}$、DAC 建立、参考建立和 SAR logic timing margin。


## 相关笔记

- [ADC 比较器：架构、关键指标与设计方法](/GarveyDing_AcademicPages/blog/adc-comparators/)
- [Bandgap 基准源：架构与设计](/GarveyDing_AcademicPages/blog/bandgap-reference/)
- [TSMC 28 nm CMOS 片上无源器件：电阻、电容与电感](/GarveyDing_AcademicPages/blog/cmos28-passive-devices/)
