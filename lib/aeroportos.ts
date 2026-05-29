export interface Aeroporto {
  iata: string
  nome: string
  cidade: string
  estado: string
  pais: string
  aliases: string[]
}

const AEROPORTOS: Aeroporto[] = [
  // ─── Brasileiros ─────────────────────────────────────────────────
  { iata: 'GRU', nome: 'Aeroporto Internacional de Guarulhos', cidade: 'Guarulhos', estado: 'SP', pais: 'Brasil', aliases: ['gru', 'guarulhos', 'são paulo', 'sao paulo', 'sp', 'sao', 'são', 'guarulhos internacional'] },
  { iata: 'CGH', nome: 'Aeroporto de Congonhas', cidade: 'São Paulo', estado: 'SP', pais: 'Brasil', aliases: ['cgh', 'congonhas', 'são paulo', 'sao paulo', 'sp', 'sao', 'são'] },
  { iata: 'VCP', nome: 'Aeroporto Internacional de Viracopos', cidade: 'Campinas', estado: 'SP', pais: 'Brasil', aliases: ['vcp', 'viracopos', 'campinas', 'tcp', 'são paulo', 'sao paulo', 'sp', 'sao', 'são'] },
  { iata: 'GIG', nome: 'Aeroporto Internacional do Galeão', cidade: 'Rio de Janeiro', estado: 'RJ', pais: 'Brasil', aliases: ['gig', 'galeao', 'galeão', 'rio', 'rio de janeiro', 'rj'] },
  { iata: 'SDU', nome: 'Aeroporto Santos Dumont', cidade: 'Rio de Janeiro', estado: 'RJ', pais: 'Brasil', aliases: ['sdu', 'santos dumont', 'rio', 'rio de janeiro', 'rj'] },
  { iata: 'BSB', nome: 'Aeroporto Internacional de Brasília', cidade: 'Brasília', estado: 'DF', pais: 'Brasil', aliases: ['bsb', 'brasilia', 'brasília', 'df'] },
  { iata: 'SSA', nome: 'Aeroporto Internacional de Salvador', cidade: 'Salvador', estado: 'BA', pais: 'Brasil', aliases: ['ssa', 'salvador', 'ba', 'bahia', 'luis eduardo magalhaes'] },
  { iata: 'REC', nome: 'Aeroporto Internacional do Recife', cidade: 'Recife', estado: 'PE', pais: 'Brasil', aliases: ['rec', 'recife', 'pe', 'pernambuco', 'guararapes'] },
  { iata: 'FOR', nome: 'Aeroporto Internacional de Fortaleza', cidade: 'Fortaleza', estado: 'CE', pais: 'Brasil', aliases: ['for', 'fortaleza', 'ce', 'ceara', 'ceará', 'pinto martins'] },
  { iata: 'CWB', nome: 'Aeroporto Internacional Afonso Pena', cidade: 'Curitiba', estado: 'PR', pais: 'Brasil', aliases: ['cwb', 'curitiba', 'pr', 'parana', 'paraná', 'afonso pena'] },
  { iata: 'POA', nome: 'Aeroporto Internacional Salgado Filho', cidade: 'Porto Alegre', estado: 'RS', pais: 'Brasil', aliases: ['poa', 'porto alegre', 'rs', 'rio grande do sul', 'salgado filho'] },
  { iata: 'BEL', nome: 'Aeroporto Internacional de Belém', cidade: 'Belém', estado: 'PA', pais: 'Brasil', aliases: ['bel', 'belem', 'belém', 'pa', 'para', 'pará', 'val de cans'] },
  { iata: 'MAO', nome: 'Aeroporto Internacional Eduardo Gomes', cidade: 'Manaus', estado: 'AM', pais: 'Brasil', aliases: ['mao', 'manaus', 'am', 'amazonas', 'eduardo gomes'] },
  { iata: 'MCZ', nome: 'Aeroporto Internacional Zumbi dos Palmares', cidade: 'Maceió', estado: 'AL', pais: 'Brasil', aliases: ['mcz', 'maceio', 'maceió', 'al', 'alagoas'] },
  { iata: 'NAT', nome: 'Aeroporto Internacional de Natal', cidade: 'Natal', estado: 'RN', pais: 'Brasil', aliases: ['nat', 'natal', 'rn', 'rio grande do norte', 'aluizio alves'] },
  { iata: 'THE', nome: 'Aeroporto de Teresina', cidade: 'Teresina', estado: 'PI', pais: 'Brasil', aliases: ['the', 'teresina', 'pi', 'piaui', 'piauí'] },
  { iata: 'SLZ', nome: 'Aeroporto Internacional de São Luís', cidade: 'São Luís', estado: 'MA', pais: 'Brasil', aliases: ['slz', 'sao luis', 'são luís', 'ma', 'maranhao', 'maranhão'] },
  { iata: 'CGR', nome: 'Aeroporto Internacional de Campo Grande', cidade: 'Campo Grande', estado: 'MS', pais: 'Brasil', aliases: ['cgr', 'campo grande', 'ms', 'mato grosso do sul'] },
  { iata: 'CGB', nome: 'Aeroporto Internacional Marechal Rondon', cidade: 'Cuiabá', estado: 'MT', pais: 'Brasil', aliases: ['cgb', 'cuiaba', 'cuiabá', 'mt', 'mato grosso'] },
  { iata: 'FLN', nome: 'Aeroporto Internacional de Florianópolis', cidade: 'Florianópolis', estado: 'SC', pais: 'Brasil', aliases: ['fln', 'florianopolis', 'florianópolis', 'sc', 'santa catarina', 'hercilio luz'] },
  { iata: 'VIX', nome: 'Aeroporto de Vitória', cidade: 'Vitória', estado: 'ES', pais: 'Brasil', aliases: ['vix', 'vitoria', 'vitória', 'es', 'espirito santo', 'espírito santo'] },
  { iata: 'JPA', nome: 'Aeroporto Internacional de João Pessoa', cidade: 'João Pessoa', estado: 'PB', pais: 'Brasil', aliases: ['jpa', 'joao pessoa', 'joão pessoa', 'pb', 'paraiba', 'paraíba'] },
  { iata: 'AJU', nome: 'Aeroporto de Aracaju', cidade: 'Aracaju', estado: 'SE', pais: 'Brasil', aliases: ['aju', 'aracaju', 'se', 'sergipe'] },
  { iata: 'PMW', nome: 'Aeroporto de Palmas', cidade: 'Palmas', estado: 'TO', pais: 'Brasil', aliases: ['pmw', 'palmas', 'to', 'tocantins'] },
  { iata: 'PVH', nome: 'Aeroporto Internacional de Porto Velho', cidade: 'Porto Velho', estado: 'RO', pais: 'Brasil', aliases: ['pvh', 'porto velho', 'ro', 'rondonia', 'rondônia'] },
  { iata: 'MCP', nome: 'Aeroporto Internacional de Macapá', cidade: 'Macapá', estado: 'AP', pais: 'Brasil', aliases: ['mcp', 'macapa', 'macapá', 'ap', 'amapa', 'amapá'] },
  { iata: 'BVB', nome: 'Aeroporto Internacional de Boa Vista', cidade: 'Boa Vista', estado: 'RR', pais: 'Brasil', aliases: ['bvb', 'boa vista', 'rr', 'roraima'] },
  { iata: 'RBR', nome: 'Aeroporto Internacional de Rio Branco', cidade: 'Rio Branco', estado: 'AC', pais: 'Brasil', aliases: ['rbr', 'rio branco', 'ac', 'acre'] },
  { iata: 'MGF', nome: 'Aeroporto Regional de Maringá', cidade: 'Maringá', estado: 'PR', pais: 'Brasil', aliases: ['mgf', 'maringa', 'maringá', 'pr'] },
  { iata: 'LDB', nome: 'Aeroporto de Londrina', cidade: 'Londrina', estado: 'PR', pais: 'Brasil', aliases: ['ldb', 'londrina', 'lon', 'pr'] },
  { iata: 'JOI', nome: 'Aeroporto de Joinville', cidade: 'Joinville', estado: 'SC', pais: 'Brasil', aliases: ['joi', 'joinville', 'sc'] },
  { iata: 'XAP', nome: 'Aeroporto de Chapecó', cidade: 'Chapecó', estado: 'SC', pais: 'Brasil', aliases: ['xap', 'chapeco', 'chapecó', 'sc'] },
  { iata: 'UDI', nome: 'Aeroporto de Uberlândia', cidade: 'Uberlândia', estado: 'MG', pais: 'Brasil', aliases: ['udi', 'uberlandia', 'uberlândia', 'mg'] },
  { iata: 'CNF', nome: 'Aeroporto Internacional Tancredo Neves', cidade: 'Belo Horizonte', estado: 'MG', pais: 'Brasil', aliases: ['cnf', 'confins', 'belo horizonte', 'bh', 'mg', 'minas gerais', 'tancredo neves'] },
  { iata: 'PLU', nome: 'Aeroporto Carlos Drummond de Andrade', cidade: 'Belo Horizonte', estado: 'MG', pais: 'Brasil', aliases: ['plu', 'pampulha', 'belo horizonte', 'bh', 'mg', 'minas gerais'] },
  { iata: 'IOS', nome: 'Aeroporto de Ilhéus', cidade: 'Ilhéus', estado: 'BA', pais: 'Brasil', aliases: ['ios', 'ilheus', 'ilhéus', 'ba'] },
  { iata: 'BPS', nome: 'Aeroporto de Porto Seguro', cidade: 'Porto Seguro', estado: 'BA', pais: 'Brasil', aliases: ['bps', 'porto seguro', 'ba'] },
  { iata: 'IGU', nome: 'Aeroporto Internacional das Cataratas', cidade: 'Foz do Iguaçu', estado: 'PR', pais: 'Brasil', aliases: ['igu', 'foz', 'foz do iguacu', 'foz do iguaçu', 'pr', 'iguassu', 'cataratas'] },
  { iata: 'CXJ', nome: 'Aeroporto de Caxias do Sul', cidade: 'Caxias do Sul', estado: 'RS', pais: 'Brasil', aliases: ['cxj', 'caxias', 'caxias do sul', 'rs'] },
  { iata: 'NVT', nome: 'Aeroporto de Navegantes', cidade: 'Navegantes', estado: 'SC', pais: 'Brasil', aliases: ['nvt', 'navegantes', 'sc'] },
  { iata: 'ITJ', nome: 'Aeroporto de Itajaí', cidade: 'Itajaí', estado: 'SC', pais: 'Brasil', aliases: ['itj', 'itajai', 'itajaí', 'sc'] },
  { iata: 'CFB', nome: 'Aeroporto de Cabo Frio', cidade: 'Cabo Frio', estado: 'RJ', pais: 'Brasil', aliases: ['cfb', 'cabo frio', 'rj'] },
  { iata: 'JDO', nome: 'Aeroporto de Juazeiro do Norte', cidade: 'Juazeiro do Norte', estado: 'CE', pais: 'Brasil', aliases: ['jdo', 'juazeiro', 'juazeiro do norte', 'ce'] },
  { iata: 'CPV', nome: 'Aeroporto de Campina Grande', cidade: 'Campina Grande', estado: 'PB', pais: 'Brasil', aliases: ['cpv', 'campina grande', 'pb'] },
  { iata: 'IPN', nome: 'Aeroporto de Ipatinga', cidade: 'Ipatinga', estado: 'MG', pais: 'Brasil', aliases: ['ipn', 'ipatinga', 'mg'] },
  { iata: 'MOC', nome: 'Aeroporto de Montes Claros', cidade: 'Montes Claros', estado: 'MG', pais: 'Brasil', aliases: ['moc', 'montes claros', 'mg'] },
  { iata: 'PET', nome: 'Aeroporto de Pelotas', cidade: 'Pelotas', estado: 'RS', pais: 'Brasil', aliases: ['pet', 'pelotas', 'rs'] },
  { iata: 'BGX', nome: 'Aeroporto de Bagé', cidade: 'Bagé', estado: 'RS', pais: 'Brasil', aliases: ['bgx', 'bage', 'bagé', 'rs'] },
  { iata: 'URG', nome: 'Aeroporto de Uruguaiana', cidade: 'Uruguaiana', estado: 'RS', pais: 'Brasil', aliases: ['urg', 'uruguaiana', 'rs'] },
  { iata: 'CZS', nome: 'Aeroporto de Cruzeiro do Sul', cidade: 'Cruzeiro do Sul', estado: 'AC', pais: 'Brasil', aliases: ['czs', 'cruzeiro do sul', 'ac'] },
  { iata: 'STM', nome: 'Aeroporto de Santarém', cidade: 'Santarém', estado: 'PA', pais: 'Brasil', aliases: ['stm', 'santarem', 'santarém', 'pa'] },
  { iata: 'ATM', nome: 'Aeroporto de Altamira', cidade: 'Altamira', estado: 'PA', pais: 'Brasil', aliases: ['atm', 'altamira', 'pa'] },
  { iata: 'MAB', nome: 'Aeroporto de Marabá', cidade: 'Marabá', estado: 'PA', pais: 'Brasil', aliases: ['mab', 'maraba', 'marabá', 'pa'] },
  { iata: 'PMG', nome: 'Aeroporto de Ponta Porã', cidade: 'Ponta Porã', estado: 'MS', pais: 'Brasil', aliases: ['pmg', 'ponta pora', 'ponta porã', 'ms'] },
  { iata: 'SJP', nome: 'Aeroporto de São José do Rio Preto', cidade: 'São José do Rio Preto', estado: 'SP', pais: 'Brasil', aliases: ['sjp', 'sao jose do rio preto', 'são josé do rio preto', 'sp', 'rio preto'] },
  { iata: 'ARU', nome: 'Aeroporto de Araçatuba', cidade: 'Araçatuba', estado: 'SP', pais: 'Brasil', aliases: ['aru', 'aracatuba', 'araçatuba', 'sp'] },
  { iata: 'AQA', nome: 'Aeroporto de Araraquara', cidade: 'Araraquara', estado: 'SP', pais: 'Brasil', aliases: ['aqa', 'araraquara', 'sp'] },
  { iata: 'BAU', nome: 'Aeroporto de Bauru', cidade: 'Bauru', estado: 'SP', pais: 'Brasil', aliases: ['bau', 'bauru', 'sp'] },
  { iata: 'PPB', nome: 'Aeroporto de Presidente Prudente', cidade: 'Presidente Prudente', estado: 'SP', pais: 'Brasil', aliases: ['ppb', 'presidente prudente', 'sp'] },
  { iata: 'RAO', nome: 'Aeroporto de Ribeirão Preto', cidade: 'Ribeirão Preto', estado: 'SP', pais: 'Brasil', aliases: ['rao', 'ribeirao preto', 'ribeirão preto', 'sp'] },
  { iata: 'SOD', nome: 'Aeroporto de Sorocaba', cidade: 'Sorocaba', estado: 'SP', pais: 'Brasil', aliases: ['sod', 'sorocaba', 'sp'] },
  { iata: 'CAC', nome: 'Aeroporto de Cascavel', cidade: 'Cascavel', estado: 'PR', pais: 'Brasil', aliases: ['cac', 'cascavel', 'pr'] },
  { iata: 'PFB', nome: 'Aeroporto de Passo Fundo', cidade: 'Passo Fundo', estado: 'RS', pais: 'Brasil', aliases: ['pfb', 'passo fundo', 'rs'] },
  { iata: 'PHB', nome: 'Aeroporto de Parnaíba', cidade: 'Parnaíba', estado: 'PI', pais: 'Brasil', aliases: ['phb', 'parnaiba', 'parnaíba', 'pi'] },
  // ─── Internacionais ───────────────────────────────────────────────
  { iata: 'MIA', nome: 'Miami International Airport', cidade: 'Miami', estado: 'FL', pais: 'EUA', aliases: ['mia', 'miami', 'eua', 'usa', 'estados unidos', 'florida'] },
  { iata: 'JFK', nome: 'John F. Kennedy International Airport', cidade: 'Nova York', estado: 'NY', pais: 'EUA', aliases: ['jfk', 'nova york', 'new york', 'ny', 'eua', 'usa', 'kennedy'] },
  { iata: 'LAX', nome: 'Los Angeles International Airport', cidade: 'Los Angeles', estado: 'CA', pais: 'EUA', aliases: ['lax', 'los angeles', 'la', 'eua', 'usa', 'california'] },
  { iata: 'ORD', nome: "Chicago O'Hare International Airport", cidade: 'Chicago', estado: 'IL', pais: 'EUA', aliases: ['ord', 'chicago', 'eua', 'usa', 'illinois', 'ohare'] },
  { iata: 'EWR', nome: 'Newark Liberty International Airport', cidade: 'Nova York', estado: 'NJ', pais: 'EUA', aliases: ['ewr', 'newark', 'nova york', 'new york', 'ny', 'eua', 'usa'] },
  { iata: 'MCO', nome: 'Orlando International Airport', cidade: 'Orlando', estado: 'FL', pais: 'EUA', aliases: ['mco', 'orlando', 'eua', 'usa', 'florida', 'disney'] },
  { iata: 'FLL', nome: 'Fort Lauderdale-Hollywood International Airport', cidade: 'Fort Lauderdale', estado: 'FL', pais: 'EUA', aliases: ['fll', 'fort lauderdale', 'miami', 'florida', 'eua', 'usa'] },
  { iata: 'LIS', nome: 'Aeroporto Humberto Delgado', cidade: 'Lisboa', estado: '', pais: 'Portugal', aliases: ['lis', 'lisboa', 'lisbon', 'portugal'] },
  { iata: 'MAD', nome: 'Aeropuerto Adolfo Suárez Madrid-Barajas', cidade: 'Madrid', estado: '', pais: 'Espanha', aliases: ['mad', 'madrid', 'espanha', 'spain'] },
  { iata: 'LHR', nome: 'London Heathrow Airport', cidade: 'Londres', estado: '', pais: 'Reino Unido', aliases: ['lhr', 'londres', 'london', 'heathrow', 'uk', 'reino unido'] },
  { iata: 'CDG', nome: 'Aéroport Paris-Charles de Gaulle', cidade: 'Paris', estado: '', pais: 'França', aliases: ['cdg', 'paris', 'franca', 'frança', 'charles de gaulle'] },
  { iata: 'FCO', nome: 'Aeroporto Leonardo da Vinci', cidade: 'Roma', estado: '', pais: 'Itália', aliases: ['fco', 'roma', 'rome', 'italia', 'itália', 'fiumicino'] },
  { iata: 'AMS', nome: 'Amsterdam Airport Schiphol', cidade: 'Amsterdã', estado: '', pais: 'Holanda', aliases: ['ams', 'amsterdam', 'amsterda', 'amsterdã', 'holanda', 'netherlands'] },
  { iata: 'FRA', nome: 'Frankfurt Airport', cidade: 'Frankfurt', estado: '', pais: 'Alemanha', aliases: ['fra', 'frankfurt', 'alemanha', 'germany'] },
  { iata: 'BCN', nome: 'Aeropuerto El Prat de Barcelona', cidade: 'Barcelona', estado: '', pais: 'Espanha', aliases: ['bcn', 'barcelona', 'espanha', 'spain'] },
  { iata: 'MXP', nome: 'Aeroporto di Milano Malpensa', cidade: 'Milão', estado: '', pais: 'Itália', aliases: ['mxp', 'milao', 'milão', 'milan', 'italia', 'itália', 'malpensa'] },
  { iata: 'GVA', nome: 'Genève Aéroport', cidade: 'Genebra', estado: '', pais: 'Suíça', aliases: ['gva', 'genebra', 'geneva', 'suica', 'suíça'] },
  { iata: 'ZRH', nome: 'Flughafen Zürich', cidade: 'Zurique', estado: '', pais: 'Suíça', aliases: ['zrh', 'zurique', 'zurich', 'suica', 'suíça'] },
  { iata: 'DXB', nome: 'Dubai International Airport', cidade: 'Dubai', estado: '', pais: 'Emirados', aliases: ['dxb', 'dubai', 'emirados', 'uae'] },
  { iata: 'DOH', nome: 'Hamad International Airport', cidade: 'Doha', estado: '', pais: 'Catar', aliases: ['doh', 'doha', 'catar', 'qatar'] },
  { iata: 'NRT', nome: 'Narita International Airport', cidade: 'Tóquio', estado: '', pais: 'Japão', aliases: ['nrt', 'tokyo', 'toquio', 'tóquio', 'japao', 'japão', 'narita'] },
  { iata: 'HND', nome: 'Tokyo Haneda Airport', cidade: 'Tóquio', estado: '', pais: 'Japão', aliases: ['hnd', 'tokyo', 'toquio', 'tóquio', 'japao', 'japão', 'haneda'] },
  { iata: 'ICN', nome: 'Incheon International Airport', cidade: 'Seul', estado: '', pais: 'Coreia', aliases: ['icn', 'seul', 'seoul', 'coreia', 'korea'] },
  { iata: 'SYD', nome: 'Sydney Airport', cidade: 'Sydney', estado: '', pais: 'Austrália', aliases: ['syd', 'sydney', 'australia', 'austrália'] },
  { iata: 'YYZ', nome: 'Toronto Pearson International Airport', cidade: 'Toronto', estado: '', pais: 'Canadá', aliases: ['yyz', 'toronto', 'canada', 'canadá', 'pearson'] },
  { iata: 'YUL', nome: 'Montréal-Trudeau International Airport', cidade: 'Montreal', estado: '', pais: 'Canadá', aliases: ['yul', 'montreal', 'canada', 'canadá'] },
  { iata: 'YVR', nome: 'Vancouver International Airport', cidade: 'Vancouver', estado: '', pais: 'Canadá', aliases: ['yvr', 'vancouver', 'canada', 'canadá'] },
  { iata: 'EZE', nome: 'Aeropuerto Internacional Ezeiza', cidade: 'Buenos Aires', estado: '', pais: 'Argentina', aliases: ['eze', 'buenos aires', 'argentina', 'ezeiza'] },
  { iata: 'SCL', nome: 'Aeropuerto Internacional de Santiago', cidade: 'Santiago', estado: '', pais: 'Chile', aliases: ['scl', 'santiago', 'chile'] },
  { iata: 'BOG', nome: 'Aeropuerto Internacional El Dorado', cidade: 'Bogotá', estado: '', pais: 'Colômbia', aliases: ['bog', 'bogota', 'bogotá', 'colombia', 'colômbia'] },
  { iata: 'LIM', nome: 'Aeropuerto Internacional Jorge Chávez', cidade: 'Lima', estado: '', pais: 'Peru', aliases: ['lim', 'lima', 'peru'] },
  { iata: 'GYE', nome: 'Aeropuerto Internacional José Joaquín de Olmedo', cidade: 'Guayaquil', estado: '', pais: 'Equador', aliases: ['gye', 'guayaquil', 'equador', 'ecuador'] },
  { iata: 'MEX', nome: 'Aeropuerto Internacional Benito Juárez', cidade: 'Cidade do México', estado: '', pais: 'México', aliases: ['mex', 'cidade do mexico', 'mexico', 'méxico', 'cdmx'] },
  { iata: 'CUN', nome: 'Aeropuerto Internacional de Cancún', cidade: 'Cancún', estado: '', pais: 'México', aliases: ['cun', 'cancun', 'cancún', 'mexico', 'méxico'] },
  { iata: 'PTY', nome: 'Aeropuerto Internacional de Tocumen', cidade: 'Panamá', estado: '', pais: 'Panamá', aliases: ['pty', 'panama', 'panamá', 'tocumen'] },
  { iata: 'MDE', nome: 'Aeropuerto Internacional José María Córdova', cidade: 'Medellín', estado: '', pais: 'Colômbia', aliases: ['mde', 'medellin', 'medellín', 'colombia', 'colômbia'] },
  { iata: 'UIO', nome: 'Aeropuerto Internacional Mariscal Sucre', cidade: 'Quito', estado: '', pais: 'Equador', aliases: ['uio', 'quito', 'equador', 'ecuador'] },
  { iata: 'MVD', nome: 'Aeropuerto Internacional de Carrasco', cidade: 'Montevidéu', estado: '', pais: 'Uruguai', aliases: ['mvd', 'montevideo', 'montevidéu', 'uruguai', 'uruguay'] },
  { iata: 'ASU', nome: 'Aeropuerto Internacional Silvio Pettirossi', cidade: 'Assunção', estado: '', pais: 'Paraguai', aliases: ['asu', 'assuncao', 'assunção', 'paraguai', 'paraguay'] },
  { iata: 'VVI', nome: 'Aeropuerto Internacional Viru Viru', cidade: 'Santa Cruz', estado: '', pais: 'Bolívia', aliases: ['vvi', 'santa cruz', 'bolivia', 'bolívia'] },
  { iata: 'CCS', nome: 'Aeropuerto Internacional Simón Bolívar', cidade: 'Caracas', estado: '', pais: 'Venezuela', aliases: ['ccs', 'caracas', 'venezuela'] },
  { iata: 'HAV', nome: 'Aeropuerto Internacional José Martí', cidade: 'Havana', estado: '', pais: 'Cuba', aliases: ['hav', 'havana', 'cuba'] },
]

function removerAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function buscarAeroportos(query: string): Aeroporto[] {
  const q = removerAcentos(query)
  if (q.length < 2) return []

  const exatoIATA: Aeroporto[] = []
  const comecaIATA: Aeroporto[] = []
  const cidadeExata: Aeroporto[] = []
  const cidadeParcial: Aeroporto[] = []
  const aliasMatch: Aeroporto[] = []

  for (const a of AEROPORTOS) {
    const iataL = a.iata.toLowerCase()
    const cidadeN = removerAcentos(a.cidade)
    const nomeN = removerAcentos(a.nome)
    const aliasesN = a.aliases.map(removerAcentos)

    if (iataL === q) exatoIATA.push(a)
    else if (iataL.startsWith(q)) comecaIATA.push(a)
    else if (cidadeN === q || nomeN === q) cidadeExata.push(a)
    else if (cidadeN.startsWith(q) || nomeN.startsWith(q)) cidadeParcial.push(a)
    else if (aliasesN.some(al => al === q || al.startsWith(q))) aliasMatch.push(a)
  }

  return [...exatoIATA, ...comecaIATA, ...cidadeExata, ...cidadeParcial, ...aliasMatch].slice(0, 6)
}
