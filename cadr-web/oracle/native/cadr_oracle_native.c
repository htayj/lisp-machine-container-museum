/*
 * Native CADR instruction-boundary oracle.
 *
 * This file is cleanly separated from the pinned emulator source and is copied
 * only into a verified disposable worktree.  It emits the repository's
 * CDRTRC1 little-endian envelope directly and never serializes C structures.
 */

#include <errno.h>
#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cadr_oracle_native.h"
#include "bus-interface.h"
#include "colortv.h"
#include "iob.h"
#include "machine-control.h"
#include "main-memory.h"
#include "ucode.h"
#include "unibus-mapping.h"
#include "uvmem.h"

#define ORACLE_CHECKPOINT_INTERVAL 1024u
#define ORACLE_MAX_FAMILIES 64u
#define ORACLE_BOUNDARY_S0 1u
#define ORACLE_BOUNDARY_EXECUTED 2u
#define ORACLE_BOUNDARY_INHIBITED 4u
#define ORACLE_BOUNDARY_CHECKPOINT 8u
#define ORACLE_BOUNDARY_HALT 16u

struct sha256 {
    uint32_t h[8];
    uint64_t bytes;
    uint8_t block[64];
    size_t used;
};

static const uint32_t sha_k[64] = {
    0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
    0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
    0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
    0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
    0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
    0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
    0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
    0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u
};

static uint32_t rotr(uint32_t x, unsigned n) { return (x >> n) | (x << (32u - n)); }

static void sha_transform(struct sha256 *s, const uint8_t block[64])
{
    uint32_t w[64];
    for (unsigned i = 0; i < 16; ++i)
        w[i] = ((uint32_t)block[i*4] << 24) | ((uint32_t)block[i*4+1] << 16) |
               ((uint32_t)block[i*4+2] << 8) | block[i*4+3];
    for (unsigned i = 16; i < 64; ++i) {
        uint32_t a = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >> 3);
        uint32_t b = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >> 10);
        w[i] = w[i-16] + a + w[i-7] + b;
    }
    uint32_t a=s->h[0],b=s->h[1],c=s->h[2],d=s->h[3];
    uint32_t e=s->h[4],f=s->h[5],g=s->h[6],h=s->h[7];
    for (unsigned i = 0; i < 64; ++i) {
        uint32_t s1=rotr(e,6)^rotr(e,11)^rotr(e,25);
        uint32_t ch=(e&f)^((~e)&g);
        uint32_t t1=h+s1+ch+sha_k[i]+w[i];
        uint32_t s0=rotr(a,2)^rotr(a,13)^rotr(a,22);
        uint32_t maj=(a&b)^(a&c)^(b&c);
        uint32_t t2=s0+maj;
        h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
    }
    s->h[0]+=a; s->h[1]+=b; s->h[2]+=c; s->h[3]+=d;
    s->h[4]+=e; s->h[5]+=f; s->h[6]+=g; s->h[7]+=h;
}

static void sha_init(struct sha256 *s)
{
    static const uint32_t initial[8] = {
        0x6a09e667u,0xbb67ae85u,0x3c6ef372u,0xa54ff53au,
        0x510e527fu,0x9b05688cu,0x1f83d9abu,0x5be0cd19u
    };
    memcpy(s->h, initial, sizeof(initial));
    s->bytes = 0; s->used = 0;
}

static void sha_update(struct sha256 *s, const void *source, size_t length)
{
    const uint8_t *p = source;
    s->bytes += length;
    while (length) {
        size_t take = 64 - s->used;
        if (take > length) take = length;
        memcpy(s->block + s->used, p, take);
        s->used += take; p += take; length -= take;
        if (s->used == 64) {
            sha_transform(s, s->block);
            s->used = 0;
        }
    }
}

static void sha_final(struct sha256 *s, uint8_t out[32])
{
    uint64_t bits = s->bytes * 8;
    s->block[s->used++] = 0x80;
    if (s->used > 56) {
        memset(s->block + s->used, 0, 64 - s->used);
        sha_transform(s, s->block);
        s->used = 0;
    }
    memset(s->block + s->used, 0, 56 - s->used);
    for (unsigned i = 0; i < 8; ++i)
        s->block[63-i] = (uint8_t)(bits >> (i*8));
    sha_transform(s, s->block);
    for (unsigned i = 0; i < 8; ++i) {
        out[i*4]=(uint8_t)(s->h[i]>>24); out[i*4+1]=(uint8_t)(s->h[i]>>16);
        out[i*4+2]=(uint8_t)(s->h[i]>>8); out[i*4+3]=(uint8_t)s->h[i];
    }
}

static void hash_parts(uint8_t out[32], const void *a, size_t an,
                       const void *b, size_t bn, const void *c, size_t cn)
{
    struct sha256 s; sha_init(&s);
    sha_update(&s,a,an); sha_update(&s,b,bn); sha_update(&s,c,cn);
    sha_final(&s,out);
}

static void put16(uint8_t *p, uint16_t v) { p[0]=(uint8_t)v; p[1]=(uint8_t)(v>>8); }
static void put32(uint8_t *p, uint32_t v) { for (unsigned i=0;i<4;++i) p[i]=(uint8_t)(v>>(i*8)); }
static void put64(uint8_t *p, uint64_t v) { for (unsigned i=0;i<8;++i) p[i]=(uint8_t)(v>>(i*8)); }

static uint32_t crc_table[256];
static bool crc_ready;

static uint32_t crc32c(const uint8_t *p, size_t n)
{
    if (!crc_ready) {
        for (unsigned i=0;i<256;++i) {
            uint32_t v=i;
            for (unsigned j=0;j<8;++j) v=(v>>1)^((v&1)?0x82f63b78u:0);
            crc_table[i]=v;
        }
        crc_ready=true;
    }
    uint32_t v=0xffffffffu;
    while (n--) v=crc_table[(v^*p++)&0xff]^(v>>8);
    return v^0xffffffffu;
}

enum tree_kind { TREE_U16, TREE_U32, TREE_U64, TREE_MAIN_PAGE };
struct state_tree {
    uint32_t family;
    enum tree_kind kind;
    const void *values;
    uint32_t count;
    uint32_t leaves;
    uint8_t *nodes;
};

extern uint32_t old_q;
extern uint32_t dispatch_constant;
extern uint32_t interrupt_control;
extern uint32_t new_md;
extern uint32_t new_md_delay;
extern uint32_t oa_reg_low, oa_reg_high;
extern uint32_t aaddr, maddr;
extern int adata, mdata;
extern uint32_t op;
extern bool popj, oal, oah;
extern uint32_t alu_carry, alu_out;
extern uint16_t unibus_mapping_registers[16];
extern uint16_t unibus_mapping_buffers[16];
extern uint32_t tv_screen_buffer[32768];
extern uint32_t iob_csr;
extern uint16_t the_60_cycle_clock;

static struct state_tree trees[] = {
    {CADR_ORACLE_PROM,TREE_U64,prom,512,0,NULL},
    {CADR_ORACLE_IMEM,TREE_U64,imem,16384,0,NULL},
    {CADR_ORACLE_AMEM,TREE_U32,amem,1024,0,NULL},
    {CADR_ORACLE_MMEM,TREE_U32,mmem,32,0,NULL},
    {CADR_ORACLE_DMEM,TREE_U32,dmem,2048,0,NULL},
    {CADR_ORACLE_PDL,TREE_U32,pdl,1024,0,NULL},
    {CADR_ORACLE_SPC,TREE_U32,spc,32,0,NULL},
    {CADR_ORACLE_L1_MAP,TREE_U32,l1_map,2048,0,NULL},
    {CADR_ORACLE_L2_MAP,TREE_U32,l2_map,1024,0,NULL},
    {CADR_ORACLE_MAIN_MEMORY,TREE_MAIN_PAGE,NULL,0,0,NULL},
    {CADR_ORACLE_TV_MEMORY,TREE_U32,tv_screen_buffer,32768,0,NULL},
    {CADR_ORACLE_COLOR_TV_MEMORY,TREE_U32,colortv_screen_buffer,32768,0,NULL},
    {CADR_ORACLE_COLOR_MAP,TREE_U32,colortv_color_map,64,0,NULL},
    {CADR_ORACLE_UNIBUS_MAP,TREE_U16,unibus_mapping_registers,16,0,NULL}
    ,{CADR_ORACLE_UNIBUS_BUFFER,TREE_U16,unibus_mapping_buffers,16,0,NULL}
};

static FILE *trace_file;
static FILE *report_file;
static FILE *component_dump_file;
static uint64_t slot_limit, boundary_ordinal, record_sequence, mutation_ordinal;
static uint64_t slot_first_mutation, slot_mutations;
static uint64_t family_counts[ORACLE_MAX_FAMILIES];
static uint8_t prior_boundary_hash[32];
static uint8_t empty_mutation_hash[32];
static struct sha256 mutation_hash;
static bool slot_was_inhibited;
static bool oracle_started, oracle_failed;
static uint64_t negative_alu_slot = UINT64_MAX;
static uint64_t negative_alu_exercised_slot = UINT64_MAX;
static uint64_t first_alu_slot = UINT64_MAX;

struct begin_latch {
    uint64_t raw_word;
    uint64_t effective_word;
    uint32_t pc;
    uint32_t store_selector;
    uint32_t operation;
    uint32_t a_address;
    uint32_t m_address;
    uint32_t a_value;
    uint32_t m_value;
    bool instruction_memory;
    bool functional_m_source;
    bool effective_popj;
    bool inhibited;
    bool decoded;
};
static struct begin_latch begin_latch;

static uint8_t device_roots[ORACLE_MAX_FAMILIES][32];
static bool device_present[ORACLE_MAX_FAMILIES];
static bool snapshot_active, snapshot_checking;
static uint32_t snapshot_family;
static struct sha256 snapshot_hash;
static uint8_t identity_hashes[9][32];
#define ORACLE_MAX_DUMP_BOUNDARIES 256u
static uint64_t dump_boundaries[ORACLE_MAX_DUMP_BOUNDARIES];
static size_t dump_boundary_count, dump_boundary_next;

extern void cadr_oracle_snapshot_bus_interface(void);
extern void cadr_oracle_snapshot_disk(void);
extern void cadr_oracle_snapshot_tv(void);
extern void cadr_oracle_snapshot_colortv(void);
extern void cadr_oracle_snapshot_chaos(void);
extern void cadr_oracle_snapshot_tape(void);
extern void cadr_oracle_snapshot_iob(void);

static void fatal(const char *message)
{
    fprintf(stderr,"cadr-oracle: %s\n",message);
    if (trace_file) fclose(trace_file);
    if (component_dump_file) fclose(component_dump_file);
    exit(70);
}

static uint8_t parse_hex_byte(const char *pair)
{
    if (!isxdigit((unsigned char)pair[0]) ||
            !isxdigit((unsigned char)pair[1]))
        fatal("invalid oracle identity hex pair");
    unsigned high=(unsigned)(pair[0]<='9'?pair[0]-'0':
        (tolower((unsigned char)pair[0])-'a'+10));
    unsigned low=(unsigned)(pair[1]<='9'?pair[1]-'0':
        (tolower((unsigned char)pair[1])-'a'+10));
    return (uint8_t)((high<<4)|low);
}

static uint64_t tree_value(const struct state_tree *t, uint32_t index)
{
    switch (t->kind) {
    case TREE_U16: return ((const uint16_t *)t->values)[index];
    case TREE_U32: return ((const uint32_t *)t->values)[index];
    case TREE_U64: return ((const uint64_t *)t->values)[index];
    default: return 0;
    }
}

static void tree_leaf(const struct state_tree *t, uint32_t index, uint8_t out[32])
{
    static const uint8_t domain[]="CDRLEAF1\0";
    struct sha256 s; uint8_t b[12]; sha_init(&s);
    sha_update(&s,domain,sizeof(domain)-1);
    put32(b,t->family); put32(b+4,index);
    if (t->kind == TREE_MAIN_PAGE) {
        put32(b+8,1024); sha_update(&s,b,sizeof(b));
        uint8_t word[4];
        for (uint32_t i=0;i<256;++i) {
            put32(word,cadr_oracle_main_memory_word(index*256+i));
            sha_update(&s,word,4);
        }
    } else {
        uint32_t width=t->kind==TREE_U64?8:(t->kind==TREE_U32?4:2);
        put32(b+8,width); sha_update(&s,b,sizeof(b));
        uint8_t value[8]; put64(value,tree_value(t,index));
        sha_update(&s,value,width);
    }
    sha_final(&s,out);
}

static void tree_parent(const struct state_tree *t, uint32_t level,
                        const uint8_t left[32], const uint8_t right[32],
                        uint8_t out[32])
{
    static const uint8_t domain[]="CDRNODE1\0";
    struct sha256 s; uint8_t b[8]; sha_init(&s);
    sha_update(&s,domain,sizeof(domain)-1);
    put32(b,t->family); put32(b+4,level); sha_update(&s,b,sizeof(b));
    sha_update(&s,left,32); sha_update(&s,right,32); sha_final(&s,out);
}

static void tree_build(struct state_tree *t)
{
    t->count = t->kind==TREE_MAIN_PAGE ? main_memory_npages : t->count;
    t->leaves=1;
    while (t->leaves<t->count) t->leaves<<=1;
    if (!t->nodes) {
        t->nodes=calloc((size_t)t->leaves*2,32);
        if (!t->nodes) fatal("cannot allocate canonical state tree");
    }
    for (uint32_t i=0;i<t->leaves;++i) {
        if (i<t->count) tree_leaf(t,i,t->nodes+(size_t)(t->leaves+i)*32);
        else {
            static const uint8_t absent[]="CDRABSENT1\0";
            uint8_t b[8]; put32(b,t->family); put32(b+4,i);
            hash_parts(t->nodes+(size_t)(t->leaves+i)*32,absent,sizeof(absent)-1,b,8,"",0);
        }
    }
    uint32_t level=0;
    for (uint32_t width=t->leaves; width>1; width>>=1,++level) {
        uint32_t base=width>>1;
        for (uint32_t i=0;i<base;++i)
            tree_parent(t,level,t->nodes+(size_t)(width+i*2)*32,
                        t->nodes+(size_t)(width+i*2+1)*32,
                        t->nodes+(size_t)(base+i)*32);
    }
}

static void tree_update(struct state_tree *t, uint32_t index)
{
    if (index>=t->count) fatal("mutation index exceeds canonical state tree");
    uint32_t node=t->leaves+index, level=0;
    tree_leaf(t,index,t->nodes+(size_t)node*32);
    while (node>1) {
        uint32_t parent=node>>1, left=parent<<1;
        tree_parent(t,level,t->nodes+(size_t)left*32,
                    t->nodes+(size_t)(left+1)*32,
                    t->nodes+(size_t)parent*32);
        node=parent; ++level;
    }
}

static struct state_tree *find_tree(uint32_t family)
{
    for (size_t i=0;i<sizeof(trees)/sizeof(trees[0]);++i)
        if (trees[i].family==family) return &trees[i];
    return NULL;
}

static void verify_trees(void)
{
    for (size_t i=0;i<sizeof(trees)/sizeof(trees[0]);++i) {
        uint8_t expected[32]; memcpy(expected,trees[i].nodes+32,32);
        tree_build(&trees[i]);
        if (memcmp(expected,trees[i].nodes+32,32)!=0)
            fatal("unhandled mutation changed canonical state tree");
    }
}

static void mutation_event(uint32_t family, uint32_t index,
                           uint64_t old_value, uint64_t new_value,
                           uint32_t disposition)
{
    if (!oracle_started || oracle_failed) return;
    uint8_t event[32];
    put32(event,family); put32(event+4,index);
    put64(event+8,old_value); put64(event+16,new_value);
    put32(event+24,disposition); put32(event+28,0);
    sha_update(&mutation_hash,event,sizeof(event));
    ++slot_mutations;
    if (family<ORACLE_MAX_FAMILIES) ++family_counts[family];
}

void cadr_oracle_write_u32(uint32_t family, uint32_t index,
                           uint32_t old_value, uint32_t new_value)
{
    mutation_event(family,index,old_value,new_value,0);
    struct state_tree *t=find_tree(family);
    if (!t) fatal("write hook names an unregistered state family");
    tree_update(t,index);
}

void cadr_oracle_write_u64(uint32_t family, uint32_t index,
                           uint64_t old_value, uint64_t new_value)
{
    mutation_event(family,index,old_value,new_value,0);
    struct state_tree *t=find_tree(family);
    if (!t) fatal("write hook names an unregistered state family");
    tree_update(t,index);
}

void cadr_oracle_event_u32(uint32_t family, uint32_t index,
                           uint32_t value, uint32_t disposition)
{
    mutation_event(family,index,value,value,disposition);
}

void cadr_oracle_main_memory_page_changed(uint32_t page_number)
{
    mutation_event(CADR_ORACLE_MAIN_MEMORY,page_number,0,0,1);
    tree_update(find_tree(CADR_ORACLE_MAIN_MEMORY),page_number);
}

static void state_u32(struct sha256 *s, uint32_t tag, uint32_t value)
{
    uint8_t b[8]; put32(b,tag); put32(b+4,value); sha_update(s,b,8);
}
static void state_u64(struct sha256 *s, uint32_t tag, uint64_t value)
{
    uint8_t b[12]; put32(b,tag); put64(b+4,value); sha_update(s,b,12);
}

struct state_scalar {
    uint32_t tag;
    uint32_t width;
    uint64_t value;
};

static size_t state_scalars(struct state_scalar scalars[60])
{
    size_t n=0;
#define SCALAR32(tag_, value_) do { \
    scalars[n]=(struct state_scalar){(tag_),4,(uint32_t)(value_)}; ++n; \
} while (0)
#define SCALAR64(tag_, value_) do { \
    scalars[n]=(struct state_scalar){(tag_),8,(uint64_t)(value_)}; ++n; \
} while (0)
    SCALAR64(1,machine_cycles); SCALAR64(2,p0&0xffffffffffffu);
    SCALAR64(3,p1&0xffffffffffffu); SCALAR64(4,debug_ir&0xffffffffffffu);
    SCALAR64(5,iwr&0xffffffffffffu);
    SCALAR32(6,p0_pc); SCALAR32(7,p1_pc); SCALAR32(8,npc);
    SCALAR32(9,p0_imem); SCALAR32(10,p1_imem);
    SCALAR32(11,lc); SCALAR32(12,q); SCALAR32(13,old_q);
    SCALAR32(14,vma_reg); SCALAR32(15,md_reg);
    SCALAR32(16,new_md); SCALAR32(17,new_md_delay);
    SCALAR32(18,dispatch_constant); SCALAR32(19,interrupt_control);
    SCALAR32(20,interrupt_status_reg); SCALAR32(21,interrupt_pending_flag);
    SCALAR32(22,spcptr); SCALAR32(23,pdl_pointer); SCALAR32(24,pdl_index);
    SCALAR32(25,oa_reg_low); SCALAR32(26,oa_reg_high);
    SCALAR32(27,oal); SCALAR32(28,oah); SCALAR32(29,aaddr);
    SCALAR32(30,maddr); SCALAR32(31,adata); SCALAR32(32,mdata);
    SCALAR32(33,op); SCALAR32(34,popj); SCALAR32(35,alu_out);
    SCALAR32(36,alu_carry); SCALAR32(37,out); SCALAR32(38,inhibit);
    SCALAR32(39,opc); SCALAR32(40,machine_state.halted);
    SCALAR32(41,machine_state.vmaok); SCALAR32(42,machine_state.promdisabled);
    SCALAR32(43,main_memory_npages); SCALAR32(44,iob_csr);
    SCALAR32(45,the_60_cycle_clock);
    SCALAR32(46,bus_interface_get_bus_error_status());
    SCALAR64(47,begin_latch.raw_word&0xffffffffffffu);
    SCALAR64(48,begin_latch.effective_word&0xffffffffffffu);
    SCALAR32(49,begin_latch.pc); SCALAR32(50,begin_latch.store_selector);
    SCALAR32(51,begin_latch.operation); SCALAR32(52,begin_latch.a_address);
    SCALAR32(53,begin_latch.m_address); SCALAR32(54,begin_latch.a_value);
    SCALAR32(55,begin_latch.m_value); SCALAR32(56,begin_latch.instruction_memory);
    SCALAR32(57,begin_latch.functional_m_source);
    SCALAR32(58,begin_latch.effective_popj); SCALAR32(59,begin_latch.inhibited);
    SCALAR32(60,begin_latch.decoded);
#undef SCALAR32
#undef SCALAR64
    if (n!=60) fatal("canonical scalar inventory is incomplete");
    return n;
}

static void state_hash_from_scalars(const struct state_scalar *scalars,
                                    size_t scalar_count,
                                    uint8_t out_hash[32])
{
    static const uint8_t domain[]="CDRSTATE1\0";
    struct sha256 s; sha_init(&s); sha_update(&s,domain,sizeof(domain)-1);
    for (size_t i=0;i<scalar_count;++i) {
        if (scalars[i].width==4)
            state_u32(&s,scalars[i].tag,(uint32_t)scalars[i].value);
        else if (scalars[i].width==8)
            state_u64(&s,scalars[i].tag,scalars[i].value);
        else fatal("invalid canonical scalar width");
    }
    for (size_t i=0;i<sizeof(trees)/sizeof(trees[0]);++i) {
        uint8_t tag[4]; put32(tag,trees[i].family);
        sha_update(&s,tag,4); sha_update(&s,trees[i].nodes+32,32);
    }
    for (unsigned i=0;i<ORACLE_MAX_FAMILIES;++i) if (device_present[i]) {
        uint8_t tag[4]; put32(tag,i);
        sha_update(&s,tag,4); sha_update(&s,device_roots[i],32);
    }
    sha_final(&s,out_hash);
}

static void state_hash(uint8_t out_hash[32])
{
    struct state_scalar scalars[60];
    size_t count=state_scalars(scalars);
    state_hash_from_scalars(scalars,count,out_hash);
}

static void print_hex(FILE *file, const uint8_t *bytes, size_t length)
{
    static const char hex[]="0123456789abcdef";
    for (size_t i=0;i<length;++i) {
        fputc(hex[bytes[i]>>4],file);
        fputc(hex[bytes[i]&15],file);
    }
}

static void component_dump_boundary(const uint8_t state[32])
{
    if (!component_dump_file || dump_boundary_next>=dump_boundary_count ||
            dump_boundaries[dump_boundary_next]!=boundary_ordinal) return;
    struct state_scalar scalars[60];
    size_t scalar_count=state_scalars(scalars);
    uint8_t recomputed[32];
    state_hash_from_scalars(scalars,scalar_count,recomputed);
    if (memcmp(recomputed,state,32)) fatal("component dump state digest mismatch");
    fprintf(component_dump_file,
            "{\"schema\":\"cadr-oracle-component-boundary\",\"schema_version\":1,"
            "\"boundary_ordinal\":%llu,\"cycle\":%llu,"
            "\"scalar_encoding\":\"unsigned-decimal-little-endian\","
            "\"scalars\":[",
            (unsigned long long)boundary_ordinal,
            (unsigned long long)machine_cycles);
    for (size_t i=0;i<scalar_count;++i)
        fprintf(component_dump_file,"%s{\"tag\":%u,\"width\":%u,\"value\":%llu}",
                i?",":"",scalars[i].tag,scalars[i].width,
                (unsigned long long)scalars[i].value);
    fprintf(component_dump_file,"],\"tree_roots\":[");
    for (size_t i=0;i<sizeof(trees)/sizeof(trees[0]);++i) {
        fprintf(component_dump_file,"%s{\"family\":%u,\"sha256\":\"",
                i?",":"",trees[i].family);
        print_hex(component_dump_file,trees[i].nodes+32,32);
        fputs("\"}",component_dump_file);
    }
    fputs("],\"device_roots\":[",component_dump_file);
    bool comma=false;
    for (unsigned i=0;i<ORACLE_MAX_FAMILIES;++i) if (device_present[i]) {
        fprintf(component_dump_file,"%s{\"family\":%u,\"sha256\":\"",
                comma?",":"",i);
        print_hex(component_dump_file,device_roots[i],32);
        fputs("\"}",component_dump_file); comma=true;
    }
    fputs("],\"state_sha256\":\"",component_dump_file);
    print_hex(component_dump_file,state,32);
    fputs("\"}\n",component_dump_file);
    if (ferror(component_dump_file)) fatal("cannot write component dump");
    ++dump_boundary_next;
}

void cadr_oracle_latch_fetched(uint64_t raw_word, uint32_t pc,
                               bool instruction_memory)
{
    memset(&begin_latch,0,sizeof(begin_latch));
    begin_latch.raw_word=raw_word&0xffffffffffffu;
    begin_latch.effective_word=begin_latch.raw_word;
    begin_latch.pc=pc;
    begin_latch.instruction_memory=instruction_memory;
    begin_latch.store_selector=instruction_memory?1u:0u;
}

void cadr_oracle_latch_decoded(uint64_t effective_word, uint32_t operation,
                               bool effective_popj, uint32_t a_address,
                               uint32_t m_address, bool functional_m_source,
                               uint32_t a_value, uint32_t m_value)
{
    begin_latch.effective_word=effective_word&0xffffffffffffu;
    begin_latch.operation=operation;
    begin_latch.effective_popj=effective_popj;
    begin_latch.a_address=a_address;
    begin_latch.m_address=m_address;
    begin_latch.functional_m_source=functional_m_source;
    begin_latch.a_value=a_value;
    begin_latch.m_value=m_value;
    begin_latch.decoded=true;
}

void cadr_oracle_latch_inhibited(void)
{
    begin_latch.inhibited=true;
}

uint32_t cadr_oracle_alu_behavior(uint32_t pc, uint32_t alu_operation,
                                  uint32_t value)
{
    (void)pc; (void)alu_operation;
    if (first_alu_slot==UINT64_MAX) first_alu_slot=boundary_ordinal+1;
    if (boundary_ordinal+1==negative_alu_slot) {
        negative_alu_exercised_slot=boundary_ordinal+1;
        return value^1u;
    }
    return value;
}

void cadr_oracle_snapshot_begin(uint32_t family)
{
    if (snapshot_active || family>=ORACLE_MAX_FAMILIES)
        fatal("invalid nested device snapshot");
    snapshot_active=true; snapshot_family=family; sha_init(&snapshot_hash);
    static const uint8_t domain[]="CDRDEVICE1\0";
    sha_update(&snapshot_hash,domain,sizeof(domain)-1);
    uint8_t value[4]; put32(value,family); sha_update(&snapshot_hash,value,4);
}

void cadr_oracle_snapshot_u32(uint32_t tag, uint32_t value)
{
    if (!snapshot_active) fatal("device snapshot feed without begin");
    uint8_t bytes[8]; put32(bytes,tag); put32(bytes+4,value);
    sha_update(&snapshot_hash,bytes,sizeof(bytes));
}

void cadr_oracle_snapshot_u64(uint32_t tag, uint64_t value)
{
    if (!snapshot_active) fatal("device snapshot feed without begin");
    uint8_t bytes[12]; put32(bytes,tag); put64(bytes+4,value);
    sha_update(&snapshot_hash,bytes,sizeof(bytes));
}

void cadr_oracle_snapshot_bytes(uint32_t tag, const void *bytes, size_t length)
{
    if (!snapshot_active || (!bytes && length)) fatal("invalid device snapshot bytes");
    uint8_t prefix[12]; put32(prefix,tag); put64(prefix+4,length);
    sha_update(&snapshot_hash,prefix,sizeof(prefix)); sha_update(&snapshot_hash,bytes,length);
}

void cadr_oracle_snapshot_end(void)
{
    if (!snapshot_active) fatal("device snapshot end without begin");
    uint8_t root[32]; sha_final(&snapshot_hash,root); snapshot_active=false;
    if (!device_present[snapshot_family]) {
        memcpy(device_roots[snapshot_family],root,32);
        device_present[snapshot_family]=true;
    } else if (memcmp(device_roots[snapshot_family],root,32)) {
        if (snapshot_checking) fatal("unhandled device mutation changed canonical root");
        mutation_event(snapshot_family,0,0,0,2);
        memcpy(device_roots[snapshot_family],root,32);
    }
}

void cadr_oracle_refresh_device_states(void)
{
    cadr_oracle_snapshot_bus_interface();
    cadr_oracle_snapshot_disk();
    cadr_oracle_snapshot_tv();
    cadr_oracle_snapshot_colortv();
    cadr_oracle_snapshot_chaos();
    cadr_oracle_snapshot_tape();
    cadr_oracle_snapshot_iob();
}

static size_t tlv(uint8_t *out, uint16_t type, const void *value, uint32_t length)
{
    put16(out,type); put16(out+2,1); put32(out+4,length);
    memcpy(out+8,value,length);
    size_t n=8+length, padded=(n+7)&~(size_t)7;
    memset(out+n,0,padded-n);
    return padded;
}

static size_t tlv_optional(uint8_t *out, uint16_t type,
                           const void *value, uint32_t length)
{
    put16(out,type); put16(out+2,0); put32(out+4,length);
    memcpy(out+8,value,length);
    size_t n=8+length, padded=(n+7)&~(size_t)7;
    memset(out+n,0,padded-n);
    return padded;
}

static void write_record(uint16_t kind, uint64_t cycle,
                         const uint8_t *payload, uint32_t payload_length)
{
    uint8_t record[1024]; size_t padding=(0u-(32u+payload_length+4u))&7u;
    size_t total=32u+payload_length+padding+4u;
    if (total>sizeof(record)) fatal("oracle record exceeds fixed encoder buffer");
    memset(record,0,total);
    put32(record,(uint32_t)total); put16(record+4,kind);
    put64(record+8,record_sequence); put64(record+16,cycle);
    put32(record+24,payload_length);
    memcpy(record+32,payload,payload_length);
    put32(record+total-4,crc32c(record,total-4));
    if (fwrite(record,1,total,trace_file)!=total) fatal("cannot write trace record");
    ++record_sequence;
}

static void boundary_record(uint32_t flags)
{
    uint8_t payload[1024], state[32], mutation[32], value8[8], value4[4];
    size_t n=0; state_hash(state);
    component_dump_boundary(state);
    if (slot_mutations) {
        struct sha256 copy=mutation_hash; sha_final(&copy,mutation);
    } else memcpy(mutation,empty_mutation_hash,32);
    n+=tlv(payload+n,1,prior_boundary_hash,32);
    n+=tlv(payload+n,2,state,32);
    n+=tlv(payload+n,3,mutation,32);
    put64(value8,boundary_ordinal); n+=tlv(payload+n,4,value8,8);
    if (boundary_ordinal) {
        put64(value8,boundary_ordinal-1); n+=tlv(payload+n,5,value8,8);
    }
    put64(value8,slot_first_mutation); n+=tlv(payload+n,6,value8,8);
    put64(value8,slot_mutations); n+=tlv(payload+n,7,value8,8);
    put32(value4,flags); n+=tlv(payload+n,8,value4,4);
    if (boundary_ordinal==0)
        for (unsigned i=0;i<9;++i)
            n+=tlv_optional(payload+n,(uint16_t)(100+i),identity_hashes[i],32);
    write_record(1,machine_cycles,payload,(uint32_t)n);
    static const uint8_t domain[]="CDRBOUND1\0";
    hash_parts(prior_boundary_hash,domain,sizeof(domain)-1,payload,n,"",0);
    mutation_ordinal+=slot_mutations;
}

void cadr_oracle_start(uint64_t limit)
{
    if (oracle_started) fatal("oracle started more than once");
    const char *trace_path=getenv("CADR_ORACLE_TRACE");
    const char *report_path=getenv("CADR_ORACLE_REPORT");
    const char *uuid_hex=getenv("CADR_ORACLE_UUID");
    static const char *identity_names[8] = {
        "CADR_ORACLE_PROFILE_SHA256","CADR_ORACLE_SOURCE_MANIFEST_SHA256",
        "CADR_ORACLE_PATCH_SHA256","CADR_ORACLE_EXECUTABLE_SHA256",
        "CADR_ORACLE_CONFIG_SHA256","CADR_ORACLE_DISK_SHA256",
        "CADR_ORACLE_PREPARED_TREE_SHA256","CADR_ORACLE_INPUT_AGGREGATE_SHA256"
    };
    if (!trace_path||!report_path||!uuid_hex||strlen(uuid_hex)!=32)
        fatal("oracle output paths and identity UUID are required");
    for (unsigned identity=0;identity<8;++identity) {
        const char *hex=getenv(identity_names[identity]);
        if (!hex||strlen(hex)!=64) fatal("complete oracle identity hashes are required");
        for (unsigned i=0;i<32;++i)
            identity_hashes[identity+1][i]=parse_hex_byte(hex+i*2);
    }
    struct sha256 identity; sha_init(&identity);
    static const uint8_t identity_domain[]="CDRIDENT1\0";
    sha_update(&identity,identity_domain,sizeof(identity_domain)-1);
    for (unsigned i=1;i<9;++i) sha_update(&identity,identity_hashes[i],32);
    sha_final(&identity,identity_hashes[0]);
    uint8_t uuid[16];
    for (unsigned i=0;i<16;++i) uuid[i]=parse_hex_byte(uuid_hex+i*2);
    if (memcmp(uuid,identity_hashes[0],16))
        fatal("identity UUID does not match complete identity bundle");
    trace_file=fopen(trace_path,"wb");
    report_file=fopen(report_path,"wb");
    if (!trace_file||!report_file) fatal("cannot open oracle output");
    slot_limit=limit;
    const char *dump_path=getenv("CADR_ORACLE_COMPONENT_DUMP");
    const char *dump_selection=getenv("CADR_ORACLE_COMPONENT_BOUNDARIES");
    if ((dump_path && !dump_selection) || (!dump_path && dump_selection))
        fatal("component dump path and boundary selection must be provided together");
    if (dump_path) {
        component_dump_file=fopen(dump_path,"wb");
        if (!component_dump_file) fatal("cannot open component dump");
        const char *cursor=dump_selection;
        uint64_t prior=0;
        while (*cursor) {
            if (dump_boundary_count==ORACLE_MAX_DUMP_BOUNDARIES)
                fatal("too many component dump boundaries");
            char *end=NULL; errno=0;
            unsigned long long value=strtoull(cursor,&end,10);
            if (errno || end==cursor || (*end && *end!=',') || value>limit ||
                    (dump_boundary_count && value<=prior))
                fatal("invalid component dump boundary selection");
            dump_boundaries[dump_boundary_count++]=(uint64_t)value;
            prior=(uint64_t)value;
            cursor=*end?end+1:end;
        }
        if (!dump_boundary_count || dump_boundaries[0]!=0)
            fatal("component dump boundary selection must include S0");
    }
    const char *negative=getenv("CADR_ORACLE_NEGATIVE_ALU_SLOT");
    if (negative && *negative) {
        char *end=NULL; errno=0;
        unsigned long long parsed=strtoull(negative,&end,10);
        if (errno || !end || *end || parsed>limit)
            fatal("invalid CADR_ORACLE_NEGATIVE_ALU_SLOT");
        negative_alu_slot=(uint64_t)parsed;
    }
    for (size_t i=0;i<sizeof(trees)/sizeof(trees[0]);++i) tree_build(&trees[i]);
    cadr_oracle_refresh_device_states();
    static const uint8_t empty_domain[]="CDRMUT1\0";
    hash_parts(empty_mutation_hash,empty_domain,sizeof(empty_domain)-1,"",0,"",0);
    uint8_t header[64]; memset(header,0,sizeof(header));
    memcpy(header,"CDRTRC1\0",8); put16(header+8,1); put16(header+10,64);
    put64(header+16,negative_alu_slot==UINT64_MAX?limit+2:UINT64_MAX);
    memcpy(header+24,uuid,16);
    put32(header+60,crc32c(header,60));
    if (fwrite(header,1,64,trace_file)!=64) fatal("cannot write trace header");
    oracle_started=true;
    slot_first_mutation=0; slot_mutations=0; boundary_ordinal=0;
    boundary_record(ORACLE_BOUNDARY_S0);
}

void cadr_oracle_slot_begin(bool inhibited)
{
    slot_was_inhibited=inhibited;
    slot_first_mutation=mutation_ordinal;
    slot_mutations=0;
    sha_init(&mutation_hash);
    static const uint8_t domain[]="CDRMUT1\0";
    sha_update(&mutation_hash,domain,sizeof(domain)-1);
}

void cadr_oracle_slot_end(bool halted)
{
    ++boundary_ordinal;
    uint32_t flags=slot_was_inhibited?ORACLE_BOUNDARY_INHIBITED:ORACLE_BOUNDARY_EXECUTED;
    if ((boundary_ordinal%ORACLE_CHECKPOINT_INTERVAL)==0 || boundary_ordinal==slot_limit) {
        verify_trees();
        snapshot_checking=true; cadr_oracle_refresh_device_states(); snapshot_checking=false;
        flags|=ORACLE_BOUNDARY_CHECKPOINT;
    }
    if (halted) flags|=ORACLE_BOUNDARY_HALT;
    boundary_record(flags);
}

static void terminal_record(uint32_t status, uint32_t reason)
{
    uint8_t payload[128], value8[8], value4[4]; size_t n=0;
    put64(value8,record_sequence+1); n+=tlv(payload+n,1,value8,8);
    put64(value8,boundary_ordinal); n+=tlv(payload+n,2,value8,8);
    n+=tlv(payload+n,3,prior_boundary_hash,32);
    put32(value4,status); n+=tlv(payload+n,4,value4,4);
    put32(value4,reason); n+=tlv(payload+n,5,value4,4);
    write_record(4,machine_cycles,payload,(uint32_t)n);
}

void cadr_oracle_finish(bool halted)
{
    if (!oracle_started||oracle_failed) return;
    terminal_record(0,halted?0:1);
    if (fflush(trace_file)||fclose(trace_file)) fatal("cannot finalize trace");
    trace_file=NULL;
    if (component_dump_file) {
        if (dump_boundary_next!=dump_boundary_count)
            fatal("requested component dump boundary was not reached");
        if (fflush(component_dump_file)||fclose(component_dump_file))
            fatal("cannot finalize component dump");
        component_dump_file=NULL;
    }
    fprintf(report_file,"{\"schema\":\"cadr-oracle-prefix-closure\",\"schema_version\":1,"
            "\"slot_limit\":%llu,\"boundary_count\":%llu,\"mutation_count\":%llu,"
            "\"checkpoint_interval\":%u,\"external_event_count\":0,"
            "\"first_alu_slot\":%llu,\"negative_alu_exercised_slot\":%s",
            (unsigned long long)slot_limit,(unsigned long long)(boundary_ordinal+1),
            (unsigned long long)mutation_ordinal,ORACLE_CHECKPOINT_INTERVAL,
            (unsigned long long)first_alu_slot,
            negative_alu_exercised_slot==UINT64_MAX?"null":"");
    if (negative_alu_exercised_slot!=UINT64_MAX)
        fprintf(report_file,"%llu",(unsigned long long)negative_alu_exercised_slot);
    fprintf(report_file,",\"families\":{");
    bool comma=false;
    for (unsigned i=0;i<ORACLE_MAX_FAMILIES;++i) if (family_counts[i]) {
        fprintf(report_file,"%s\"%u\":%llu",comma?",":"",i,
                (unsigned long long)family_counts[i]); comma=true;
    }
    fprintf(report_file,"}}\n");
    if (fflush(report_file)||fclose(report_file)) fatal("cannot finalize prefix report");
    report_file=NULL; oracle_started=false;
}

void cadr_oracle_external_event(uint32_t source, uint32_t event,
                                const char *detail)
{
    if (!oracle_started) fatal("external event before S0");
    uint8_t payload[256], value4[4]; size_t n=0;
    put32(value4,source); n+=tlv(payload+n,1,value4,4);
    put32(value4,event); n+=tlv(payload+n,2,value4,4);
    if (!detail) detail="";
    size_t length=strlen(detail); if (length>128) length=128;
    n+=tlv(payload+n,3,detail,(uint32_t)length);
    write_record(3,machine_cycles,payload,(uint32_t)n);
    terminal_record(2,3);
    oracle_failed=true;
    fflush(trace_file); fclose(trace_file); trace_file=NULL;
    fatal("uncontrolled external event reached native oracle");
}
