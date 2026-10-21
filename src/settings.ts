interface Profile {
	fullName: string
	title: string
	institute: string
	author_name: string
	summary: string
	research_areas: { title: string; description: string; field: string }[]
}

export const profile: Profile = {
	fullName: 'Jiawei Ding',
	title: 'Ph.D. Student',
	institute: 'Institute of Microelectronics, Chinese Academy of Sciences, University of Chinese Academy of Sciences',
	author_name: 'Jiawei Ding',
	summary: 'Research on ultra-high-speed analog-to-digital converters (ADCs), mixed-signal integrated circuits, and practical data-converter architectures.',
	research_areas: [
		{ title: 'Ultra-high-speed ADCs', description: 'Time-interleaved and pipeline/SAR data converters for high-bandwidth sampling.', field: 'engineering' },
		{ title: 'Mixed-signal IC design', description: 'Analog front ends, references, comparators, buffers, and digital calibration circuits.', field: 'engineering' },
		{ title: 'Data-converter calibration', description: 'Mismatch modeling, time-skew estimation, and robust digital correction methods.', field: 'computer-science' },
	],
}

export const social = {
	email: '1016387429@qq.com',
	linkedin: '',
	x: '',
	bluesky: '',
	github: 'https://github.com/GarveyDing2002',
	gitlab: '',
	scholar: 'https://scholar.google.com/citations?user=ezFjnM0AAAAJ&hl=zh-CN',
	inspire: '',
	arxiv: '',
	orcid: '',
}

export const template = {
	website_url: 'https://garveyding2002.github.io',
	menu_left: false,
	transitions: true,
	lightTheme: 'light',
	darkTheme: 'dark',
	excerptLength: 200,
	postPerPage: 5,
	base: '/GarveyDing_AcademicPages'
}

export const seo = {
	default_title: 'Jiawei Ding | Mixed-Signal IC Research',
	default_description: 'Personal academic website of Jiawei Ding, a Ph.D. student working on ultra-high-speed ADCs and mixed-signal integrated circuits.',
	default_image: `${template.base}/images/profile.jpg`,
}
