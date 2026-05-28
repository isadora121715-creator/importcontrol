import glob, openpyxl, json, math, datetime, re, urllib.request, os, sys

files = glob.glob(r'C:\Users\*\OneDrive\Desktop\isadora\Outros\Cadastro de cota*.xlsx')
EXCEL = files[0]
print('File:', EXCEL)
wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)

# helpers
def fd(v):
    if v is None: return None
    if isinstance(v, (datetime.datetime, datetime.date)): return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', s)
    if m: return '%s-%s-%s' % (m.group(3), m.group(2).zfill(2), m.group(1).zfill(2))
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m: return s[:10]
    return None

def fn(v):
    if v is None or v == '': return None
    try:
        n = float(str(v).replace(',','.').replace(' ','').replace('\xa0',''))
        return None if math.isnan(n) else round(n, 4)
    except: return None

def fs(v):
    if v is None: return None
    s = str(v).strip().replace('\xa0',' ').replace('\t','').strip()
    return None if s in ('', 'null', '*') else s

def get_forn(r, start, count):
    result = []
    for i in range(count):
        b = start + i*3
        nome  = fs(r[b])   if b < len(r)   else None
        preco = fn(r[b+1]) if b+1 < len(r) else None
        data  = fd(r[b+2]) if b+2 < len(r) else None
        if nome:
            result.append({'nome': nome, 'preco': preco, 'data': data})
    return result

rows = []

# FLANGES (header row 3, data row 4)
ws = wb['CADASTRO COTAÇÕES - FLANGES']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[7]) and not fs(r[6]): continue
    rows.append({'sheet':'FLANGES','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':fs(r[3]),
        'dataCotacao':fd(r[4]),'tipoMaterial':fs(r[5]),'codigo':fs(r[6]),'product':fs(r[7]),
        'classe':fs(r[8]),'sch':fs(r[10]),'dn':fs(r[11]),'material':fs(r[12]),'qty':fn(r[15]),
        'fornecedores':get_forn(r,17,4),'menorPreco':fn(r[30]),'fornecedorMenorPreco':fs(r[31]),'obs':fs(r[29])})

# TUBULARES
ws = wb['CADASTRO COTAÇÕES TUBULARES']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[7]) and not fs(r[6]): continue
    rows.append({'sheet':'TUBULARES','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':fs(r[3]),
        'dataCotacao':fd(r[4]),'tipoMaterial':fs(r[5]),'codigo':fs(r[6]),'product':fs(r[7]),
        'classe':fs(r[8]),'sch':fs(r[10]),'dn':fs(r[11]),'material':fs(r[12]),'qty':fn(r[14]),
        'fornecedores':get_forn(r,16,6),'menorPreco':fn(r[35]),'fornecedorMenorPreco':fs(r[36]),'obs':fs(r[34])})

# FORJADINHOS
ws = wb['CADASTRO COTAÇÕES FORJADINHOS']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[7]) and not fs(r[6]): continue
    rows.append({'sheet':'FORJADINHOS','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':fs(r[3]),
        'dataCotacao':fd(r[4]),'tipoMaterial':fs(r[5]),'codigo':fs(r[6]),'product':fs(r[7]),
        'classe':fs(r[8]),'sch':fs(r[10]),'dn':fs(r[11]),'material':fs(r[12]),'qty':fn(r[14]),
        'fornecedores':get_forn(r,16,4),'menorPreco':None,'fornecedorMenorPreco':None,'obs':fs(r[31])})

# JUNTA ANEL
ws = wb['CADASTRO COTAÇÕES JUNTA ANEL']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[7]) and not fs(r[6]): continue
    rows.append({'sheet':'JUNTA ANEL','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':fs(r[3]),
        'dataCotacao':fd(r[4]),'tipoMaterial':fs(r[5]),'codigo':fs(r[6]),'product':fs(r[7]),
        'classe':fs(r[11]),'sch':None,'dn':fs(r[8]),'material':fs(r[9]),'qty':fn(r[16]),
        'fornecedores':get_forn(r,18,4),'menorPreco':None,'fornecedorMenorPreco':None,'obs':fs(r[30])})

# JUNTA ESPIRAL
ws = wb['CADASTRO COTAÇÕES JUNTA ESPIRAL']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[7]) and not fs(r[6]): continue
    rows.append({'sheet':'JUNTA ESPIRAL','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':fs(r[3]),
        'dataCotacao':fd(r[4]),'tipoMaterial':fs(r[5]),'codigo':fs(r[6]),'product':fs(r[7]),
        'classe':fs(r[9]),'sch':None,'dn':fs(r[11]),'material':fs(r[10]),'qty':fn(r[15]),
        'fornecedores':get_forn(r,17,4),'menorPreco':None,'fornecedorMenorPreco':None,'obs':fs(r[29])})

# FIGURA 8, RAQ
ws = wb['CADASTRO COTAÇÕES FIGURA 8, RAQ']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[7]) and not fs(r[6]): continue
    rows.append({'sheet':'FIGURA 8 / RAQ','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':fs(r[3]),
        'dataCotacao':fd(r[4]),'tipoMaterial':fs(r[5]),'codigo':fs(r[6]),'product':fs(r[7]),
        'classe':fs(r[8]),'sch':fs(r[10]),'dn':fs(r[11]),'material':fs(r[12]),'qty':fn(r[14]),
        'fornecedores':get_forn(r,16,4),'menorPreco':None,'fornecedorMenorPreco':None,'obs':fs(r[28])})

# PARAFUSO
ws = wb['CADASTRO COTAÇÕES PARAFUSO ']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[5]) and not fs(r[4]): continue
    rows.append({'sheet':'PARAFUSO','rfq':fs(r[2]),'cliente':fs(r[0]),'pi':None,'op':fs(r[1]),
        'dataCotacao':fd(r[3]),'tipoMaterial':None,'codigo':fs(r[4]),'product':fs(r[5]),
        'classe':fs(r[6]),'sch':fs(r[7]),'dn':fs(r[8]),'material':fs(r[11]),'qty':fn(r[17]),
        'fornecedores':get_forn(r,18,4),'menorPreco':None,'fornecedorMenorPreco':None,'obs':fs(r[30])})

# GERAL
ws = wb['CADASTRO - GERAL']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[6]) and not fs(r[4]): continue
    rows.append({'sheet':'GERAL','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':None,
        'dataCotacao':fd(r[3]),'tipoMaterial':fs(r[7]),'codigo':fs(r[4]),'product':fs(r[6]),
        'classe':fs(r[8]),'sch':fs(r[9]),'dn':fs(r[10]),'material':fs(r[13]),'qty':fn(r[15]),
        'fornecedores':get_forn(r,16,4),'menorPreco':None,'fornecedorMenorPreco':None,'obs':None})

# PETROBRAS
ws = wb['PETROBRAS']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 4: continue
    r = list(row) + [None]*40
    if not fs(r[6]) and not fs(r[4]): continue
    rows.append({'sheet':'PETROBRAS','rfq':fs(r[0]),'cliente':fs(r[1]),'pi':fs(r[2]),'op':None,
        'dataCotacao':fd(r[3]),'tipoMaterial':fs(r[7]),'codigo':fs(r[4]),'product':fs(r[6]),
        'classe':fs(r[8]),'sch':fs(r[9]),'dn':fs(r[10]),'material':fs(r[13]),'qty':fn(r[18]),
        'fornecedores':get_forn(r,19,4),'menorPreco':None,'fornecedorMenorPreco':None,'obs':None})

print('Total rows:', len(rows))
by_sheet = {}
for row in rows:
    s = row['sheet']
    by_sheet[s] = by_sheet.get(s, 0) + 1
print('By sheet:', json.dumps(by_sheet, ensure_ascii=False))

# Write JSON
out_dirs = glob.glob(r'C:\Users\*\Downloads\importcontrol-extracted\importcontrol-main\public\data')
out_dir = out_dirs[0]
out_path = os.path.join(out_dir, 'cotacoes-cache.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False)
print('Written:', out_path, '|', os.path.getsize(out_path), 'bytes')
